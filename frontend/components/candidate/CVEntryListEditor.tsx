'use client';

import { Plus, Trash2, X } from 'lucide-react';

export interface EntryField {
  key: string;
  label: string;
  placeholder?: string;
}

interface CVEntryListEditorProps {
  items: Array<Record<string, unknown>>;
  onChange: (items: Array<Record<string, unknown>>) => void;
  fields: EntryField[];
  addLabel: string;
  emptyLabel: string;
  bulletsLabel?: string;
  disabled?: boolean;
}

function textValue(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  return typeof value === 'string' ? value : value != null ? String(value) : '';
}

function bulletsValue(item: Record<string, unknown>): string[] {
  const bullets = item.bullets;
  return Array.isArray(bullets) ? bullets.map((b) => (typeof b === 'string' ? b : String(b))) : [];
}

export default function CVEntryListEditor({
  items,
  onChange,
  fields,
  addLabel,
  emptyLabel,
  bulletsLabel = 'Gạch đầu dòng',
  disabled = false,
}: CVEntryListEditorProps) {
  const updateEntry = (index: number, patch: Record<string, unknown>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const removeEntry = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    onChange([...items, {}]);
  };

  const updateBullet = (index: number, bulletIndex: number, value: string) => {
    const bullets = [...bulletsValue(items[index])];
    bullets[bulletIndex] = value;
    updateEntry(index, { bullets });
  };

  const addBullet = (index: number) => {
    const bullets = [...bulletsValue(items[index]), ''];
    updateEntry(index, { bullets });
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const bullets = bulletsValue(items[index]).filter((_, i) => i !== bulletIndex);
    updateEntry(index, { bullets });
  };

  return (
    <div className="cv-entry-list">
      {items.length === 0 && <p className="cv-entry-empty">{emptyLabel}</p>}
      {items.map((item, index) => (
        <article key={index} className="cv-entry-card">
          <div className="cv-entry-card-fields">
            {fields.map((field) => (
              <label key={field.key} className="cv-entry-field">
                {field.label}
                <input
                  disabled={disabled}
                  placeholder={field.placeholder}
                  value={textValue(item, field.key)}
                  onChange={(event) => updateEntry(index, { [field.key]: event.target.value })}
                />
              </label>
            ))}
          </div>

          <div className="cv-entry-bullets">
            <span className="cv-entry-bullets-label">{bulletsLabel}</span>
            {bulletsValue(item).map((bullet, bulletIndex) => (
              <div key={bulletIndex} className="cv-entry-bullet-row">
                <input
                  disabled={disabled}
                  value={bullet}
                  onChange={(event) => updateBullet(index, bulletIndex, event.target.value)}
                  placeholder="Mô tả nhiệm vụ, kết quả hoặc thành tựu..."
                />
                <button
                  type="button"
                  className="cv-entry-bullet-remove"
                  onClick={() => removeBullet(index, bulletIndex)}
                  disabled={disabled}
                  title="Xóa gạch đầu dòng này"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="cv-entry-add-bullet"
              onClick={() => addBullet(index)}
              disabled={disabled}
            >
              <Plus size={14} /> Thêm gạch đầu dòng
            </button>
          </div>

          <button
            type="button"
            className="cv-entry-remove"
            onClick={() => removeEntry(index)}
            disabled={disabled}
          >
            <Trash2 size={14} /> Xóa mục này
          </button>
        </article>
      ))}
      <button type="button" className="cv-entry-add" onClick={addEntry} disabled={disabled}>
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}
