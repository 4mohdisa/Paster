#!/usr/bin/env python3
"""
Wrapper script to call Kash actions programmatically from outside the Kash shell.
This allows us to use Kash actions without being in the interactive shell.
"""

import sys
import json
from pathlib import Path

# Add Kash to path if installed via py-app-standalone
kash_env = Path.home() / '.paster' / 'kash-env'
if kash_env.exists():
    sys.path.insert(0, str(kash_env))

def run_kash_action(action_name: str, file_path: str):
    """Run a Kash action on a file."""
    try:
        # Import Kash components
        from kash.model import Item
        from kash.file_storage.file_store import FileStore
        
        # First, load our custom actions
        custom_action_file = Path(__file__).parent / 'kash_docx_action.py'
        if custom_action_file.exists():
            import runpy
            runpy.run_path(str(custom_action_file))
        
        # Import the action registry to find our action
        from kash.exec.action_registry import ActionRegistry
        
        # Get the action
        action_class = ActionRegistry.get_action_class(action_name)
        if not action_class:
            return {
                "success": False,
                "error": f"Action '{action_name}' not found"
            }
        
        # Create a FileStore for workspace management
        workspace_dir = Path.home() / '.paster' / 'kash-workspace'
        workspace_dir.mkdir(parents=True, exist_ok=True)
        store = FileStore(workspace_dir, is_global_ws=True, auto_init=True)
        
        # Import the file into workspace
        imported_path = store.import_item(file_path)
        
        # Load the item
        item = store.load(imported_path)
        
        # Execute the action
        action_instance = action_class()
        result_item = action_instance.execute(item)
        
        # Save the result
        if result_item:
            result_path = store.save(result_item)
            
            # Also save locally with appropriate extension
            output_path = Path(file_path).with_suffix('.md')
            if result_item.body:
                output_path.write_text(result_item.body)
            
            return {
                "success": True,
                "action": action_name,
                "input_file": str(file_path),
                "output_file": str(output_path),
                "workspace_path": str(result_path),
                "content": result_item.body[:1000] if result_item.body else None
            }
        else:
            return {
                "success": False,
                "error": "Action produced no output"
            }
            
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    """Main entry point."""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: kash_wrapper.py <action_name> <file_path>"
        }))
        sys.exit(1)
    
    action_name = sys.argv[1]
    file_path = sys.argv[2]
    
    result = run_kash_action(action_name, file_path)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("success") else 1)

if __name__ == "__main__":
    main()