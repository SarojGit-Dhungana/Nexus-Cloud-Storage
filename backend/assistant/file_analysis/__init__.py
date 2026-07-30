"""
Local file-analysis engine for NexusStorage AI Assistance.

Uses a trainable TF-IDF extractive summarizer (no external AI APIs).
Train with: python manage.py train_file_analyzer
"""

from .analyzer import FileAnalysisService

__all__ = ["FileAnalysisService"]
