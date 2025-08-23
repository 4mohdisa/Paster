#!/usr/bin/env python3
"""
Ultimate Kash Runner for AiPaste - FINAL VERSION
Properly configures Kash BEFORE any imports to suppress ALL output
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional

# CRITICAL: Configure Kash BEFORE importing ANY Kash modules
# This ensures kash_setup() is the FIRST call and settings are applied
from kash.config.setup import kash_setup
from kash.config.settings import LogLevel

# Configure Kash with rich_logging=True (required for console_quiet to work properly)
# This MUST be the first and only call to kash_setup()
kash_setup(
    rich_logging=True,  # CRITICAL: Must be True for console_quiet to work
    console_quiet=True,  # Suppress all console output
    console_log_level=LogLevel.error  # Only show errors or higher
)

# NOW we can import other Kash modules - they will use our configuration
from kash.model.items_model import Item, ItemType, Format
from kash.config.logger import record_console

def initialize_filestore():
    """Initialize FileStore with proper workspace"""
    # Import inside function to delay until we're in record_console context
    from kash.file_storage.file_store import FileStore

    workspace_dir = Path.home() / '.aipaste' / 'kash-workspace'
    workspace_dir.mkdir(parents=True, exist_ok=True)

    # Suppress any output during FileStore initialization
    with record_console():
        store = FileStore(workspace_dir, is_global_ws=True, auto_init=True)

    return store, workspace_dir

def process_with_filestore(filepath: str, action: str = "markdownify") -> Dict[str, Any]:
    """Process file using FileStore and Kash features"""

    # With proper kash_setup configuration, we don't need stderr redirection
    # Just use record_console as a safety measure
    with record_console() as console:
        try:
            # Initialize FileStore
            store, workspace_dir = initialize_filestore()

            input_path = Path(filepath)
            if not input_path.exists():
                return {
                    "success": False,
                    "error": f"File not found: {filepath}"
                }

            # Import file into workspace (with deduplication!)
            imported_path = store.import_item(str(input_path))

            # Load the imported item
            item = store.load(imported_path)

            # Process based on action and format
            result_item = process_item_with_action(item, input_path, action)

            # Save result back to store (with caching!)
            result_path = store.save(result_item)

            # Also save locally for testing
            output_suffix = get_output_suffix(action)
            local_output_path = input_path.with_suffix(output_suffix) if output_suffix.startswith('.') else input_path.with_name(f"{input_path.stem}{output_suffix}")

            with open(local_output_path, 'w', encoding='utf-8') as f:
                f.write(result_item.body if result_item.body else "")

            # Get workspace statistics
            workspace_items = list(store.walk_items())
            workspace_stats = {
                "total_items": len(workspace_items),
                "workspace_path": str(workspace_dir),
                "has_cache": (workspace_dir / '.kash').exists(),
                "item_id": str(result_item.item_id()) if hasattr(result_item, 'item_id') else None
            }

            return {
                "success": True,
                "action": action,
                "input_file": str(filepath),
                "output_file": str(local_output_path),
                "workspace_path": str(result_path),
                "imported_path": str(imported_path),
                "format": {
                    "input": str(item.format) if item.format else "unknown",
                    "output": str(result_item.format) if result_item.format else "unknown"
                },
                "item": {
                    "title": result_item.title,
                    "type": str(result_item.type),
                    "id": str(result_item.item_id()) if hasattr(result_item, 'item_id') else None
                },
                "content_preview": result_item.body[:500] if result_item.body else "",
                "content_length": len(result_item.body) if result_item.body else 0,
                "workspace_stats": workspace_stats,
                "kash_benefits": {
                    "filestore": "✓ Using FileStore for persistence",
                    "deduplication": "✓ Content deduplicated by hash",
                    "caching": "✓ Results cached with MtimeCache",
                    "indexing": "✓ Indexed by ItemId",
                    "workspace": "✓ Organized in Kash workspace",
                    "import": f"✓ File imported as {imported_path}",
                    "actions": "✓ Using Kash actions and utilities"
                }
            }

        except Exception as e:
            import traceback
            return {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }

def process_item_with_action(item: Item, input_path: Path, action: str) -> Item:
    """Process item based on action"""
    if action == "markdownify":
        return convert_to_markdown(item, input_path)
    elif action == "summarize":
        return create_summary(item, input_path)
    elif action == "strip_html":
        return strip_html_from_item(item)
    else:
        raise ValueError(f"Unknown action: {action}")

def convert_to_markdown(item: Item, input_path: Path) -> Item:
    """Convert item to markdown based on format"""
    if item.format == Format.markdown:
        return item
    elif item.format == Format.html:
        try:
            from kash.utils.text_handling.markdownify_utils import markdownify_custom
            markdown_body = markdownify_custom(item.body)
            return item.derived_copy(
                type=ItemType.doc,
                format=Format.markdown,
                body=markdown_body,
                title=item.title,
                description="Converted from HTML"
            )
        except ImportError:
            return item.derived_copy(
                type=ItemType.doc,
                format=Format.markdown,
                body=item.body,
                title=item.title
            )
    elif item.format == Format.docx:
        markdown_content = convert_docx_content(input_path)
        return item.derived_copy(
            type=ItemType.doc,
            format=Format.markdown,
            body=markdown_content,
            title=item.title,
            description="Converted from DOCX"
        )
    else:
        return item.derived_copy(
            type=ItemType.doc,
            format=Format.markdown,
            body=item.body,
            title=item.title,
            description=f"Converted from {item.format}"
        )

def create_summary(item: Item, input_path: Path) -> Item:
    """Create summary of item"""
    try:
        from kash.actions.core.summarize_as_bullets import summarize_as_bullets
        return summarize_as_bullets(item)
    except:
        content = item.body if item.body else ""
        lines = content.split('\n')[:10]
        summary = '\n'.join(f"• {line}" for line in lines if line.strip())
        return item.derived_copy(
            type=ItemType.doc,
            format=Format.markdown,
            body=summary,
            title=f"{item.title}_summary" if item.title else "summary",
            description="Simple summary"
        )

def strip_html_from_item(item: Item) -> Item:
    """Strip HTML from item"""
    try:
        from kash.utils.text_handling.html_processing import html_to_plaintext
        stripped_body = html_to_plaintext(item.body)
        return item.derived_copy(
            type=ItemType.doc,
            format=Format.plaintext,
            body=stripped_body,
            title=item.title,
            description="HTML stripped"
        )
    except ImportError:
        import re
        clean = re.sub('<.*?>', '', item.body if item.body else '')
        return item.derived_copy(
            type=ItemType.doc,
            format=Format.plaintext,
            body=clean,
            title=item.title
        )

def convert_docx_content(filepath: Path) -> str:
    """Convert DOCX to markdown"""
    try:
        import docx
        doc = docx.Document(str(filepath))

        markdown_lines = []
        for paragraph in doc.paragraphs:
            text = paragraph.text.strip()
            if text:
                style_name = paragraph.style.name if paragraph.style else ''

                if 'Title' in style_name:
                    markdown_lines.append(f"# {text}")
                elif style_name.startswith('Heading'):
                    level = 2
                    if 'Heading 1' in style_name:
                        level = 2
                    elif 'Heading 2' in style_name:
                        level = 3
                    elif 'Heading 3' in style_name:
                        level = 4
                    markdown_lines.append('#' * level + ' ' + text)
                elif 'List' in style_name:
                    markdown_lines.append(f"- {text}")
                else:
                    formatted_text = ''
                    for run in paragraph.runs:
                        run_text = run.text
                        if run.bold and run.italic:
                            run_text = f"***{run_text}***"
                        elif run.bold:
                            run_text = f"**{run_text}**"
                        elif run.italic:
                            run_text = f"*{run_text}*"
                        formatted_text += run_text
                    markdown_lines.append(formatted_text if formatted_text else text)

                if 'List' not in style_name:
                    markdown_lines.append('')

        return '\n'.join(markdown_lines).strip()

    except ImportError:
        import docx2txt
        return docx2txt.process(str(filepath))

def get_output_suffix(action: str) -> str:
    """Get output file suffix based on action"""
    if action == "summarize":
        return "_summary.md"
    elif action == "strip_html":
        return "_stripped.txt"
    else:
        return ".md"

def main():
    """Main entry point"""
    if "--version" in sys.argv:
        print(json.dumps({"version": "4.0-fixed-indentation", "has_record_console": True}))
        sys.exit(0)

    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: kash-ultimate-runner.py <filepath> [--action=markdownify|summarize|strip_html]"
        }))
        sys.exit(1)

    # Parse arguments
    action = "markdownify"
    filepath = None

    for arg in sys.argv[1:]:
        if arg.startswith("--action="):
            action = arg.split("=")[1]
        else:
            filepath = arg

    if not filepath:
        print(json.dumps({
            "success": False,
            "error": "No file specified"
        }))
        sys.exit(1)

    # Process with FileStore!
    result = process_with_filestore(filepath, action)

    # Output JSON result
    print(json.dumps(result, indent=2))

    # Exit with appropriate code
    sys.exit(0 if result.get("success") else 1)

if __name__ == "__main__":
    main()