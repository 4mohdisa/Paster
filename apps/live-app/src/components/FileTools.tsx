import React, { useState } from 'react';

const availableContentTypes = [
  'summary',
  'text',
  'description',
  'transcript',
  'transcript_with_timestamps',
];

export const FileTools: React.FC = () => {
  const [fileId, setFileId] = useState('');
  const [originalPath, setOriginalPath] = useState('');
  const [originalFileName, setOriginalFileName] = useState('');
  const [contentType, setContentType] = useState(availableContentTypes[0]);

  const getOptions = () => {
    const options: { fileId?: string, originalPath?: string, originalFileName?: string } = {};
    if (fileId) options.fileId = fileId;
    if (originalPath) options.originalPath = originalPath;
    if (originalFileName) options.originalFileName = originalFileName;
    return options;
  };

  const handleGetParentStatus = async () => {
    console.log('Requesting Parent Status...');
    const result = await window.electronAPI.getParentStatus();
    console.log('Parent Status Result:', result);
  };

  const handleGetDirectoryContents = async () => {
    const options = getOptions();
    if (Object.keys(options).length === 0) {
      console.error('Please provide at least one identifier (ID, Path, or Name).');
      return;
    }
    console.log('Requesting Directory Contents with options:', options);
    // const result = await window.electronAPI.getDirectoryContents(options);
    // console.log('Directory Contents Result:', result);
  };

  // const handleGetFileStatus = async () => {
  //   const options = getOptions();
  //   if (Object.keys(options).length === 0) {
  //     console.error('Please provide at least one identifier (ID, Path, or Name).');
  //     return;
  //   }
  //   console.log('Requesting File Status with options:', options);
  //   const result = await window.electronAPI.getFileStatus(options);
  //   console.log('File Status Result:', result);
  // };

  // const handleGetFileContent = async () => {
  //   const options = getOptions();
  //   if (Object.keys(options).length === 0) {
  //     console.error('Please provide at least one identifier (ID, Path, or Name).');
  //     return;
  //   }
  //   console.log(`Requesting File Content with options: ${JSON.stringify(options)} and contentType: ${contentType}`);
  //   const result = await window.electronAPI.getFileContent(options, contentType);
  //   console.log('File Content Result:', result);
  // };


  return (
    <div className="border-t border-neutral-200 bg-white">
      <div className="max-w-5xl mx-auto p-4">
        <h3 className="text-base font-semibold text-neutral-800 mb-3">File processing tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            placeholder="File ID (hashed name)"
            value={fileId}
            onChange={e => setFileId(e.target.value)}
            className="p-2 border border-neutral-300 rounded bg-white placeholder:text-neutral-400"
          />
          <input
            type="text"
            placeholder="Original file path"
            value={originalPath}
            onChange={e => setOriginalPath(e.target.value)}
            className="p-2 border border-neutral-300 rounded bg-white placeholder:text-neutral-400"
          />
          <input
            type="text"
            placeholder="Original file name (e.g., test.txt)"
            value={originalFileName}
            onChange={e => setOriginalFileName(e.target.value)}
            className="p-2 border border-neutral-300 rounded bg-white placeholder:text-neutral-400"
          />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <label htmlFor="contentType" className="text-sm text-neutral-700">Content type</label>
          <select
            id="contentType"
            value={contentType}
            onChange={e => setContentType(e.target.value)}
            className="p-2 border border-neutral-300 rounded bg-white"
          >
            {availableContentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleGetParentStatus} className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50">Get parent status</button>
          <button onClick={handleGetDirectoryContents} className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50">Get directory contents</button>
          {/* <button onClick={handleGetFileStatus} className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50">Get file status</button> */}
          {/* <button onClick={handleGetFileContent} className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50">Get file content</button> */}
        </div>
      </div>
    </div>
  );
};
