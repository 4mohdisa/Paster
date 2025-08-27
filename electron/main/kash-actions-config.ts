/**
 * Configuration for Kash actions and their required packages
 */

export interface KashActionConfig {
  id: string;
  name: string;
  description: string;
  fileTypes: string[];  // Supported file extensions
  packages: string[];   // Required Python packages
  actionName: string;   // Kash action name to call
}

export const KASH_ACTIONS: KashActionConfig[] = [
  {
    id: 'docx_to_markdown',
    name: 'DOCX to Markdown',
    description: 'Convert Word documents to Markdown format',
    fileTypes: ['.docx', '.doc'],
    packages: ['python-docx', 'docx2txt'],
    actionName: 'docx_to_markdown'
  },
  {
    id: 'html_to_markdown', 
    name: 'HTML to Markdown',
    description: 'Convert HTML files and webpages to Markdown',
    fileTypes: ['.html', '.htm'],
    packages: [],  // Built into kash-shell
    actionName: 'markdownify'
  },
  {
    id: 'summarize',
    name: 'Document Summarizer', 
    description: 'Create bullet-point summaries of documents',
    fileTypes: ['.txt', '.md', '.docx', '.doc'],
    packages: [],  // Built into kash-shell
    actionName: 'summarize_as_bullets'
  },
  {
    id: 'create_pdf',
    name: 'Create PDF',
    description: 'Convert documents to PDF format',
    fileTypes: ['.md', '.html', '.txt'],
    packages: ['weasyprint', 'pdfkit'],  // Need additional packages
    actionName: 'create_pdf'
  }
];

/**
 * Get required packages for selected actions
 */
export function getRequiredPackages(actionIds: string[]): string[] {
  const packages = new Set<string>();
  
  for (const actionId of actionIds) {
    const action = KASH_ACTIONS.find(a => a.id === actionId);
    if (action) {
      action.packages.forEach(pkg => packages.add(pkg));
    }
  }
  
  return Array.from(packages);
}

/**
 * Get the Kash action name for a file based on its extension
 */
export function getActionForFile(filePath: string, enabledActions: string[]): string | null {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) return null;
  
  for (const actionId of enabledActions) {
    const action = KASH_ACTIONS.find(a => a.id === actionId);
    if (action && action.fileTypes.includes(ext)) {
      return action.actionName;
    }
  }
  
  return null;
}