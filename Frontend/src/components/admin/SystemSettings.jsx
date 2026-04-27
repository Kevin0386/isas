import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function SystemSettings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      setSettings(res.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      await adminAPI.updateSetting(key, value);
      toast.success('Setting updated');
      fetchSettings();
    } catch (error) {
      toast.error('Update failed');
    }
    setEditingKey(null);
    setEditingValue('');
  };

  const getSettingType = (configType) => {
    switch (configType) {
      case 'integer': return 'number';
      case 'boolean': return 'checkbox';
      default: return 'text';
    }
  };

  const formatDisplayValue = (setting) => {
    if (setting.type === 'boolean') {
      return setting.value === 'true' ? 'Yes' : 'No';
    }
    return setting.value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-white">System Settings</h1>
      
      <div className="panel">
        <div className="space-y-3">
          {settings.map(setting => (
            <div key={setting.key} className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex-1">
                <p className="font-medium">{setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                <p className="text-xs text-text-muted">{setting.description || 'No description'}</p>
                {!setting.editable && (
                  <span className="text-xs text-primary mt-1 inline-block">(System read-only)</span>
                )}
              </div>
              <div className="ml-4">
                {editingKey === setting.key ? (
                  <div className="flex gap-2">
                    {setting.type === 'boolean' ? (
                      <select
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="input w-32"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        type={getSettingType(setting.type)}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="input w-40"
                      />
                    )}
                    <button onClick={() => updateSetting(setting.key, editingValue)} className="text-green-500 hover:text-green-400">
                      <i className="fas fa-check"></i>
                    </button>
                    <button onClick={() => setEditingKey(null)} className="text-primary hover:text-primary-dark">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary">{formatDisplayValue(setting)}</span>
                    {setting.editable && (
                      <button
                        onClick={() => {
                          setEditingKey(setting.key);
                          setEditingValue(setting.value);
                        }}
                        className="text-text-muted hover:text-primary ml-2"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="panel bg-sky-mid">
        <h3 className="font-medium mb-2">ℹ️ About System Settings</h3>
        <ul className="text-xs text-text-muted space-y-1">
          <li>• <strong>max_login_attempts</strong> – Failed attempts before account lockout</li>
          <li>• <strong>session_timeout_minutes</strong> – User session expiration time</li>
          <li>• <strong>pin_lock_duration_minutes</strong> – How long account stays locked</li>
          <li>• <strong>audit_log_retention_days</strong> – How long activity logs are kept</li>
          <li>• <strong>maintenance_mode</strong> – Put system in maintenance mode (restricts access)</li>
          <li>• <strong>require_strong_pin</strong> – Enforce complex PIN requirements</li>
        </ul>
      </div>
    </div>
  );
}