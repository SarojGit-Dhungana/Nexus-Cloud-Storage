"""
Train the local NexusStorage file-analysis summarizer.

Examples:
  python manage.py train_file_analyzer
  python manage.py train_file_analyzer --seed-only
  python manage.py train_file_analyzer --org-id <uuid>
  python manage.py train_file_analyzer --include-storage
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from assistant.file_analysis.extractor import extract_text, is_analyzable
from assistant.file_analysis.model import MODEL_PATH, SummarizerModel
from assistant.file_analysis.seed_corpus import iter_seed_texts
from storage.models import FileNode


class Command(BaseCommand):
    help = "Train the local TF-IDF file summarizer used by AI Assistance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--seed-only",
            action="store_true",
            help="Train only on the built-in seed corpus (no user files).",
        )
        parser.add_argument(
            "--include-storage",
            action="store_true",
            help="Also train on analyzable files already stored in NexusStorage.",
        )
        parser.add_argument(
            "--org-id",
            default="",
            help="When using --include-storage, limit training to one organization UUID.",
        )
        parser.add_argument(
            "--max-files",
            type=int,
            default=200,
            help="Maximum stored files to sample when --include-storage is set.",
        )

    def handle(self, *args, **options):
        documents: list[str] = []
        labels: list[str] = []

        if not options["include_storage"] or options["seed_only"]:
            for label, text in iter_seed_texts():
                documents.append(text)
                labels.append(f"seed:{label}")

        if options["include_storage"] and not options["seed_only"]:
            # Keep seed + storage together for a stronger baseline.
            if not any(label.startswith("seed:") for label in labels):
                for label, text in iter_seed_texts():
                    documents.append(text)
                    labels.append(f"seed:{label}")

            qs = FileNode.objects.filter(
                deleted_at__isnull=True,
                node_type=FileNode.NodeType.FILE,
            ).exclude(content="")
            org_id = (options["org_id"] or "").strip()
            if org_id:
                qs = qs.filter(organization_id=org_id)

            count = 0
            for node in qs.order_by("-updated_at")[: options["max_files"]]:
                if not is_analyzable(node.name, node.mime_type):
                    continue
                try:
                    with node.content.open("rb") as handle:
                        text = extract_text(handle, filename=node.name, mime_type=node.mime_type)
                except Exception:
                    continue
                if not text.strip():
                    continue
                documents.append(text)
                labels.append(f"storage:{node.name}")
                count += 1

            self.stdout.write(f"Loaded {count} stored file(s) for training.")

        if not documents:
            raise CommandError("No training documents found. Use --seed-only or upload analyzable files.")

        model = SummarizerModel().train(documents, labels=labels)
        path = model.save()
        self.stdout.write(self.style.SUCCESS(
            f"Trained nexus-file-analyzer on {model.document_count} documents "
            f"({model.vocabulary_size} terms). Saved to {path}"
        ))
