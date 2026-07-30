"""
Seed documents used to bootstrap the local summarizer when no user files exist.

These teach general English IDF weights so summaries work out of the box.
Retrain later on real organization files for better domain terms.
"""

SEED_DOCUMENTS = [
    (
        "cloud-storage-overview.txt",
        """
        Cloud storage lets users upload files to remote servers and access them from any device.
        Organizations use quotas, sharing permissions, and audit logs to keep data secure.
        Common file types include PDF reports, spreadsheets, images, and source code archives.
        A good storage platform provides search, versioning, antivirus scanning, and recovery from trash.
        Privacy-conscious assistants should prefer analyzing file contents locally whenever possible.
        """,
    ),
    (
        "project-status-report.txt",
        """
        The project status report summarizes progress against milestones for the current quarter.
        Engineering completed the authentication module and began work on the file sharing workflow.
        Remaining risks include delayed third-party API keys and incomplete end-to-end test coverage.
        The team recommends prioritizing antivirus scanning before enabling public share links.
        Next steps are performance testing, documentation updates, and a staged production rollout.
        """,
    ),
    (
        "security-policy.txt",
        """
        Security policy requires strong passwords, optional two-factor authentication, and encrypted transport.
        Access to organization files is limited by role: member, admin, or super administrator.
        Suspicious uploads should be scanned for malware signatures and dangerous script patterns.
        Shared links may expire automatically and can require a password for additional protection.
        Incident response includes revoking shares, rotating credentials, and reviewing activity logs.
        """,
    ),
    (
        "research-abstract.txt",
        """
        This paper investigates extractive summarization using term frequency and inverse document frequency.
        Sentences are scored by distinctive words rather than relying on commercial large language models.
        Experiments on news and technical documents show competitive readability for short summaries.
        Training on a domain corpus improves keyword ranking for specialized vocabulary.
        Future work explores multilingual support and better handling of scanned PDF images.
        """,
    ),
    (
        "meeting-notes.txt",
        """
        Meeting notes from the product sync cover roadmap items and customer feedback themes.
        Users asked for PDF summarization inside the assistant panel without sending data to third parties.
        Design agreed to keep metadata answers separate from local file content analysis.
        Engineering will ship a trainable TF-IDF model and a management command for retraining.
        QA will verify PDF, DOCX, and plain text extraction on sample uploads before release.
        """,
    ),
    (
        "invoice-guide.txt",
        """
        An invoice typically lists the vendor name, invoice number, issue date, and line items.
        Each line item describes a product or service, quantity, unit price, and extended amount.
        Taxes and discounts appear near the total due section at the bottom of the document.
        Payment terms may specify net thirty days, bank transfer details, or late fee conditions.
        Archiving invoices in cloud storage helps finance teams reconcile accounts during audits.
        """,
    ),
    (
        "onboarding-checklist.txt",
        """
        New employee onboarding includes creating an account, joining the organization, and reviewing policies.
        Admins assign storage quotas and decide whether two-factor authentication is mandatory.
        Training materials explain how to upload files, create folders, and share with teammates.
        The assistant can answer storage questions and summarize uploaded policy PDFs on request.
        Completing the checklist reduces support tickets during the first week of employment.
        """,
    ),
    (
        "data-retention.txt",
        """
        Data retention guidelines define how long files remain in active storage versus trash.
        Soft-deleted items stay recoverable until permanent purge removes binaries and metadata.
        Compliance teams may require export packages before deleting regulated documents.
        Retention schedules differ for financial records, personal data, and ephemeral drafts.
        Clear retention rules reduce legal risk and keep storage costs predictable over time.
        """,
    ),
]


def iter_seed_texts():
    for label, body in SEED_DOCUMENTS:
        yield label, " ".join(line.strip() for line in body.strip().splitlines())
