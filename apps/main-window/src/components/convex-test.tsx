'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/../../convex/_generated/api';
import { useState } from 'react';
import { Button } from '@aipaste/ui/components';

export function ConvexTest() {
  const [testKey, setTestKey] = useState('test-setting');
  const [testValue, setTestValue] = useState('Hello from Convex!');
  
  // Query settings
  const settings = useQuery(api.settings.getAll);
  
  // Mutation to update settings
  const setSetting = useMutation(api.settings.set);
  
  const handleSave = async () => {
    try {
      await setSetting({
        key: testKey,
        value: testValue,
      });
      console.log('Setting saved to Convex!');
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };
  
  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">Convex Integration Test</h3>
      
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Status: {settings !== undefined ? '✅ Connected' : '⏳ Connecting...'}
        </p>
        
        <div className="space-y-2">
          <input
            type="text"
            value={testKey}
            onChange={(e) => setTestKey(e.target.value)}
            placeholder="Setting key"
            className="px-3 py-1 border rounded"
          />
          <input
            type="text"
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            placeholder="Setting value"
            className="px-3 py-1 border rounded ml-2"
          />
          <Button onClick={handleSave} size="sm" className="ml-2">
            Save to Convex
          </Button>
        </div>
        
        {settings && (
          <div className="mt-4">
            <p className="text-sm font-medium">Current Settings:</p>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-1">
              {JSON.stringify(settings, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}