#!/usr/bin/env python3
"""
Custom Kash action for DOCX to Markdown conversion
This will be loaded into Kash after installation
"""

from kash.exec import kash_action
from kash.model import Item, Format, ItemType
from pathlib import Path

@kash_action(
    name="docx_to_markdown",
    description="Convert DOCX files to Markdown format",
    output_type=ItemType.doc,
    expected_outputs=1
)
def docx_to_markdown(item: Item) -> Item:
    """Convert a DOCX file to Markdown format - Simple action signature."""
    
    # Get file path from item
    file_path = None
    
    # Check if we have an external_path (file outside workspace)
    if item.external_path:
        file_path = Path(item.external_path)
    elif item.store_path:
        # For FileStore items, we need to resolve the full path
        # The store_path is relative to the workspace
        workspace_dir = Path.home() / '.aipaste' / 'kash-workspace'
        file_path = workspace_dir / item.store_path
    
    if not file_path:
        raise ValueError("Item must have a file path for DOCX processing")
    
    file_path = Path(file_path)
    if file_path.suffix.lower() not in ['.docx', '.doc']:
        raise ValueError(f"File must be a DOCX file, got {file_path.suffix}")
    
    try:
        # Try using python-docx for better formatting
        from docx import Document
        
        doc = Document(str(file_path))
        markdown_lines = []
        
        for paragraph in doc.paragraphs:
            text = paragraph.text.strip()
            if text:
                style_name = paragraph.style.name if paragraph.style else ''
                
                # Convert based on style
                if 'Title' in style_name:
                    markdown_lines.append(f"# {text}")
                elif 'Heading 1' in style_name:
                    markdown_lines.append(f"## {text}")
                elif 'Heading 2' in style_name:
                    markdown_lines.append(f"### {text}")
                elif 'Heading 3' in style_name:
                    markdown_lines.append(f"#### {text}")
                elif 'List' in style_name:
                    markdown_lines.append(f"- {text}")
                else:
                    # Handle bold/italic formatting
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
                
                # Add spacing after non-list items
                if 'List' not in style_name:
                    markdown_lines.append('')
        
        markdown_content = '\n'.join(markdown_lines).strip()
        
    except ImportError:
        # Fallback to docx2txt if python-docx not available
        try:
            import docx2txt
            markdown_content = docx2txt.process(str(file_path))
        except ImportError:
            raise ImportError("Neither python-docx nor docx2txt is installed. Please install one of them.")
    
    # Create new Item with markdown content
    output_item = item.derived_copy(
        type=ItemType.doc,
        format=Format.markdown,
        body=markdown_content,
        title=f"{file_path.stem}_converted",
        file_ext="md"
    )
    
    # Return the converted item (simple action returns Item, not ActionResult)
    return output_item