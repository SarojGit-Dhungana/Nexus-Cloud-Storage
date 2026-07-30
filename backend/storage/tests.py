import io
import time
import pyotp

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, User
from assistant.models import Conversation
from .models import FileNode, ShareLink


class StorageApiTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Test Workspace")
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="Strong-Test-Password!9",
            display_name="Admin",
            organization=self.organization,
            role="admin",
        )
        self.member = User.objects.create_user(
            email="member@example.com",
            password="Strong-Test-Password!9",
            display_name="Member",
            organization=self.organization,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user or self.admin)

    def test_register_creates_admin_and_organization(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/auth/register/",
            {
                "name": "Owner",
                "email": "owner@example.com",
                "password": "A-Strong-New-Password!42",
                "account_type": "organization",
                "organization_name": "New Company",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], "admin")
        self.assertIn("access", response.data)

    def test_user_can_self_register_into_existing_organization(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/auth/register/",
            {
                "name": "Regular User",
                "email": "regular@example.com",
                "password": "A-Strong-New-Password!42",
                "account_type": "user",
                "organization_slug": self.organization.slug,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], "user")
        self.assertEqual(response.data["user"]["organization"]["id"], str(self.organization.id))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        files = self.client.get("/api/files/?scope=mine")
        self.assertEqual(files.status_code, status.HTTP_200_OK)

    def test_upload_checksum_list_trash_restore_and_delete(self):
        self.authenticate()
        upload = SimpleUploadedFile("report.txt", b"confidential report", content_type="text/plain")
        response = self.client.post("/api/files/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        node_id = response.data["id"]
        self.assertEqual(len(response.data["checksum_sha256"]), 64)

        response = self.client.get("/api/files/")
        self.assertEqual(response.data["count"], 1)

        self.assertEqual(self.client.delete(f"/api/files/{node_id}/").status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get("/api/files/?scope=trash").data["count"], 1)
        self.assertEqual(
            self.client.post(f"/api/files/{node_id}/restore/?scope=trash").status_code,
            status.HTTP_200_OK,
        )

    def test_share_grant_and_hashed_public_token(self):
        self.authenticate()
        node = FileNode.objects.create(
            organization=self.organization,
            owner=self.admin,
            name="shared.txt",
            node_type="file",
            content=SimpleUploadedFile("shared.txt", b"shared"),
            size_bytes=6,
            mime_type="text/plain",
        )
        grant = self.client.post(
            f"/api/files/{node.id}/shares/",
            {"email": self.member.email, "permission": "view"},
            format="json",
        )
        self.assertEqual(grant.status_code, status.HTTP_201_CREATED)
        self.assertEqual(grant.data["status"], "pending")
        grant_id = grant.data["id"]

        self.authenticate(self.member)
        pending = self.client.get("/api/shares/?status=pending")
        self.assertEqual(pending.data["count"], 1)
        shared_before = self.client.get("/api/files/?scope=shared")
        self.assertEqual(shared_before.data["count"], 0)

        accepted = self.client.post(f"/api/shares/{grant_id}/accept/")
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        shared = self.client.get("/api/files/?scope=shared")
        self.assertEqual(shared.data["count"], 1)
        preview = self.client.get(f"/api/files/{node.id}/preview/")
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        download = self.client.get(f"/api/files/{node.id}/download/")
        self.assertEqual(download.status_code, status.HTTP_200_OK)

        revoked = self.client.post(f"/api/shares/{grant_id}/revoke/")
        self.assertEqual(revoked.status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/files/?scope=shared").data["count"], 0)

        self.authenticate()
        link_response = self.client.post(
            f"/api/files/{node.id}/share-link/",
            {"permission": "view", "password": "secret"},
            format="json",
        )
        self.assertEqual(link_response.status_code, status.HTTP_201_CREATED)
        raw_token = link_response.data["token"]
        link = ShareLink.objects.get()
        self.assertNotEqual(link.token_hash, raw_token)
        self.assertNotIn("secret", link.password_hash)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f"/api/public/shares/{raw_token}/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.client.get(f"/api/public/shares/{raw_token}/", HTTP_X_SHARE_PASSWORD="secret").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(
                f"/api/public/shares/{raw_token}/?download=1",
                HTTP_X_SHARE_PASSWORD="secret",
            ).status_code,
            status.HTTP_200_OK,
        )

    def test_assistant_is_persistent_and_tenant_scoped(self):
        self.authenticate()
        conversation = self.client.post(
            "/api/assistant/conversations/", {"title": "New conversation"}, format="json"
        )
        response = self.client.post(
            f"/api/assistant/conversations/{conversation.data['id']}/send/",
            {"message": "Show my storage report"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Conversation.objects.get().messages.count(), 2)

        self.authenticate(self.member)
        self.assertEqual(
            self.client.get(f"/api/assistant/conversations/{conversation.data['id']}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_super_admin_manages_workspaces_and_admins(self):
        super_admin = User.objects.create_user(
            email="root@example.com",
            password="Strong-Test-Password!9",
            display_name="Root",
            role=User.Role.SUPER_ADMIN,
            organization=None,
            is_staff=True,
            is_superuser=True,
        )
        self.authenticate(super_admin)

        created = self.client.post(
            "/api/auth/system/workspaces/",
            {
                "name": "NexusStorage Workspace",
                "admin_name": "Nexus Admin",
                "admin_email": "owner@nexusstorage.test",
                "admin_password": "Strong-Test-Password!9",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        workspace_id = created.data["id"]
        self.assertEqual(created.data["admin_count"], 1)

        listed = self.client.get("/api/auth/system/workspaces/")
        self.assertEqual(listed.data["count"], 2)

        suspended = self.client.patch(
            f"/api/auth/system/workspaces/{workspace_id}/", {"is_active": False}, format="json"
        )
        self.assertEqual(suspended.status_code, status.HTTP_200_OK)
        self.assertFalse(suspended.data["is_active"])

        # A member of a suspended workspace loses API access.
        new_admin = User.objects.get(email="owner@nexusstorage.test")
        self.authenticate(new_admin)
        self.assertEqual(self.client.get("/api/files/").status_code, status.HTTP_403_FORBIDDEN)

        # Super admin can demote and suspend accounts across workspaces.
        self.authenticate(super_admin)
        demoted = self.client.patch(
            f"/api/auth/system/users/{new_admin.id}/", {"role": "user", "is_active": False}, format="json"
        )
        self.assertEqual(demoted.status_code, status.HTTP_200_OK)
        self.assertEqual(demoted.data["role"], "user")
        self.assertFalse(demoted.data["is_active"])

        overview = self.client.get("/api/auth/system/overview/")
        self.assertEqual(overview.data["workspaces"], 2)
        self.assertEqual(overview.data["suspended_workspaces"], 1)

    def test_default_super_admin_exists_and_workspace_admin_cannot_escalate(self):
        from django.conf import settings

        root = User.objects.filter(role=User.Role.SUPER_ADMIN).first()
        self.assertIsNotNone(root)
        self.assertEqual(root.email, settings.SUPERADMIN_EMAIL)
        self.assertTrue(root.check_password(settings.SUPERADMIN_PASSWORD))

        # Workspace admins are blocked from the system endpoints entirely...
        self.authenticate()
        self.assertEqual(
            self.client.get("/api/auth/system/workspaces/").status_code, status.HTTP_403_FORBIDDEN
        )
        # ...and cannot promote a member to system super admin.
        escalation = self.client.patch(
            f"/api/auth/users/{self.member.id}/", {"role": "superadmin"}, format="json"
        )
        self.assertEqual(escalation.status_code, status.HTTP_400_BAD_REQUEST)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role, "user")

    def test_upload_rejects_eicar_virus_signature(self):
        self.authenticate()
        infected = SimpleUploadedFile(
            "invoice.txt",
            b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
            content_type="text/plain",
        )
        pre_scan = self.client.post("/api/files/scan/", {"file": infected}, format="multipart")
        self.assertEqual(pre_scan.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(pre_scan.data["clean"])
        self.assertEqual(pre_scan.data["threat"], "EICAR-Test-File")

        infected.seek(0)
        rejected = self.client.post("/api/files/upload/", {"file": infected}, format="multipart")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FileNode.objects.filter(name="invoice.txt").count(), 0)

        fake_pdf = SimpleUploadedFile(
            "report.pdf",
            b"<!DOCTYPE html><html><script>eval(1)</script></html>",
            content_type="application/pdf",
        )
        blocked = self.client.post("/api/files/scan/", {"file": fake_pdf}, format="multipart")
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(blocked.data["clean"])

        clean = SimpleUploadedFile("notes.txt", b"hello clean file", content_type="text/plain")
        scan_ok = self.client.post("/api/files/scan/", {"file": clean}, format="multipart")
        self.assertEqual(scan_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(scan_ok.data["clean"])
        clean.seek(0)
        accepted = self.client.post("/api/files/upload/", {"file": clean}, format="multipart")
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)
        self.assertTrue(accepted.data["scan"]["clean"])

        # Embedded "MZ" bytes must NOT false-positive inside archives/documents.
        zip_with_mz = SimpleUploadedFile(
            "bundle.zip",
            b"PK\x03\x04" + b"\x00" * 40 + b"MZ" + b"\x00" * 20,
            content_type="application/zip",
        )
        zip_scan = self.client.post("/api/files/scan/", {"file": zip_with_mz}, format="multipart")
        self.assertEqual(zip_scan.status_code, status.HTTP_200_OK)
        self.assertTrue(zip_scan.data["clean"])

    def test_regular_user_cannot_access_admin_analytics(self):
        self.authenticate(self.member)
        self.assertEqual(self.client.get("/api/admin/analytics/").status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_invite_user_with_hashed_one_time_token(self):
        self.authenticate()
        response = self.client.post(
            "/api/auth/invitations/", {"email": "invited@example.com", "role": "user"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["email_sent"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("invited@example.com", mail.outbox[0].to)
        token = response.data["invite_url"].split("invite=")[1]

        self.client.force_authenticate(user=None)
        accepted = self.client.post(
            "/api/auth/invitations/accept/",
            {"token": token, "name": "Invited User", "password": "Strong-Invited-Password!42"},
            format="json",
        )
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)
        self.assertEqual(accepted.data["user"]["organization"]["id"], str(self.organization.id))
        reused = self.client.post(
            "/api/auth/invitations/accept/",
            {"token": token, "name": "Other", "password": "Strong-Invited-Password!42"},
            format="json",
        )
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)

    def test_totp_secret_is_encrypted_and_code_required_at_login(self):
        self.authenticate()
        setup = self.client.post(
            "/api/auth/2fa/setup/", {"password": "Strong-Test-Password!9"}, format="json"
        )
        self.assertEqual(setup.status_code, status.HTTP_200_OK)
        self.assertTrue(setup.data["qr_code"].startswith("data:image/png;base64,"))
        secret = setup.data["secret"]
        self.admin.refresh_from_db()
        self.assertNotIn(secret, self.admin.totp_secret_encrypted)

        otp = pyotp.TOTP(secret).now()
        confirmed = self.client.post("/api/auth/2fa/confirm/", {"otp": otp}, format="json")
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        without_otp = self.client.post(
            "/api/auth/login/",
            {"email": self.admin.email, "password": "Strong-Test-Password!9"},
            format="json",
        )
        self.assertEqual(without_otp.status_code, status.HTTP_400_BAD_REQUEST)
        with_otp = self.client.post(
            "/api/auth/login/",
            {
                "email": self.admin.email,
                "password": "Strong-Test-Password!9",
                "otp": pyotp.TOTP(secret).now(),
            },
            format="json",
        )
        self.assertEqual(with_otp.status_code, status.HTTP_200_OK)

    def test_totp_enrollment_learns_authenticator_clock_drift(self):
        self.authenticate()
        setup = self.client.post(
            "/api/auth/2fa/setup/", {"password": "Strong-Test-Password!9"}, format="json"
        )
        secret = setup.data["secret"]
        phone_time = time.time() + 5 * 30
        phone_code = pyotp.TOTP(secret).at(phone_time)

        confirmed = self.client.post("/api/auth/2fa/confirm/", {"otp": phone_code}, format="json")
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.totp_drift_steps, 5)

        self.client.force_authenticate(user=None)
        login = self.client.post(
            "/api/auth/login/",
            {
                "email": self.admin.email,
                "password": "Strong-Test-Password!9",
                "otp": pyotp.TOTP(secret).at(time.time() + 5 * 30),
            },
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
