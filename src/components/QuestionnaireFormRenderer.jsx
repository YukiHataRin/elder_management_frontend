import React from 'react';
import { CheckCircle, FileText } from 'lucide-react';
import { getQuestionnaireFieldGroups } from '../utils/questionnaire';

const fieldBaseClass = 'w-full min-h-11 rounded-xl border border-sky-100 bg-white px-4 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-sky-100 disabled:bg-white disabled:text-text disabled:opacity-100';

const cleanOptionLabel = (value) => value
  .replace(/^[\s:：;；,，、/|]+/, '')
  .replace(/[\s:：;；,，、/|]+$/, '')
  .trim();

const getFieldOptions = (field) => {
  if (Array.isArray(field.options) && field.options.length > 0) {
    return field.options.map((option, index) => ({
      label: option.label ?? String(option.value ?? index + 1),
      value: String(option.value ?? option.label ?? index + 1),
      score: option.score,
    }));
  }

  if (!field.options_from_text && !field.label?.includes('□')) return [];

  const matches = [...String(field.label || '').matchAll(/□\s*([^□\n]+)/g)]
    .map(match => cleanOptionLabel(match[1]))
    .filter(Boolean);
  const unique = [...new Set(matches)];
  const isRenderable = unique.length >= 2 && unique.length <= 8 && unique.every(option => option.length <= 32);

  if (!isRenderable) return [];

  return unique.map(option => ({
    label: option,
    value: option,
  }));
};

const isNumberValue = (value) => value !== '' && value !== null && value !== undefined;

const FieldLabel = ({ field }) => (
  <div className="space-y-1">
    <label htmlFor={field.id} className="block text-sm font-bold leading-relaxed text-text/80">
      {field.label || field.id}
      {field.required && <span className="ml-1 text-rose-500">*</span>}
    </label>
    {field.unit && (
      <p className="text-xs font-medium text-text/45">單位：{field.unit}</p>
    )}
  </div>
);

const FieldInput = ({ field, value, onChange, disabled }) => {
  const options = getFieldOptions(field);

  if (field.type === 'acknowledgement') {
    return (
      <label className={`flex min-h-12 items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm font-bold text-text/75 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
        <input
          id={field.id}
          type="checkbox"
          className="h-4 w-4 rounded text-primary focus:ring-primary/20"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(field.id, event.target.checked)}
        />
        <span>{field.label || '已確認/已填寫'}</span>
      </label>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={field.label || field.id}>
        {[
          { label: '是', value: true },
          { label: '否', value: false },
        ].map(option => (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(field.id, option.value)}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-default disabled:opacity-100 ${
              value === option.value
                ? 'border-primary bg-primary text-white'
                : 'border-sky-100 bg-white text-text/60 hover:border-primary/30 hover:text-primary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === 'single_choice' && options.length > 0) {
    return (
      <div className="space-y-2" role="radiogroup" aria-label={field.label || field.id}>
        {options.map(option => (
          <label
            key={option.value}
            className={`flex min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer'} ${
              String(value ?? '') === option.value
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-sky-100 bg-white text-text/70 hover:border-primary/30'
            }`}
          >
            <input
              type="radio"
              name={field.id}
              className="mt-0.5 h-4 w-4 text-primary focus:ring-primary/20"
              checked={String(value ?? '') === option.value}
              disabled={disabled}
              onChange={() => onChange(field.id, option.value)}
            />
            <span className="flex-1 leading-relaxed">
              {option.label}
              {option.score !== undefined && (
                <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-text/45">
                  {option.score} 分
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'multiple_choice' && options.length > 0) {
    const selectedValues = Array.isArray(value) ? value.map(item => String(item)) : [];
    const toggleOption = (optionValue) => {
      const optionString = String(optionValue);
      const nextValues = selectedValues.includes(optionString)
        ? selectedValues.filter(item => item !== optionString)
        : [...selectedValues, optionString];
      onChange(field.id, nextValues);
    };

    return (
      <div className="space-y-2" role="group" aria-label={field.label || field.id}>
        {options.map(option => (
          <label
            key={option.value}
            className={`flex min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer'} ${
              selectedValues.includes(option.value)
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-sky-100 bg-white text-text/70 hover:border-primary/30'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary/20"
              checked={selectedValues.includes(option.value)}
              disabled={disabled}
              onChange={() => toggleOption(option.value)}
            />
            <span className="flex-1 leading-relaxed">{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <input
        id={field.id}
        type="date"
        className={fieldBaseClass}
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(field.id, event.target.value)}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <input
        id={field.id}
        type="number"
        className={fieldBaseClass}
        value={isNumberValue(value) ? value : ''}
        max={field.max}
        disabled={disabled}
        onChange={(event) => onChange(field.id, event.target.value === '' ? '' : Number(event.target.value))}
      />
    );
  }

  if (String(field.label || '').length > 120 || field.options_from_text) {
    return (
      <textarea
        id={field.id}
        rows={3}
        className={`${fieldBaseClass} resize-y`}
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(field.id, event.target.value)}
      />
    );
  }

  return (
    <input
      id={field.id}
      type="text"
      className={fieldBaseClass}
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange(field.id, event.target.value)}
    />
  );
};

const ReferenceBlocks = ({ questionnaire }) => {
  const schema = questionnaire?.schema_json || {};
  const sections = Array.isArray(schema.sections) ? schema.sections : [];
  const blockSections = sections.filter(section => Array.isArray(section.blocks) && section.blocks.length > 0);
  const tables = questionnaire?.structure_json?.tables || [];

  if (blockSections.length === 0 && tables.length === 0 && !questionnaire?.content_text) return null;

  return (
    <details className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-primary">
        <FileText size={17} />
        原始問卷參考
      </summary>
      <div className="mt-4 max-h-96 space-y-4 overflow-y-auto pr-1">
        {blockSections.map((section, sectionIndex) => (
          <div key={section.id || sectionIndex} className="space-y-3 rounded-xl border border-white bg-white/80 p-4">
            {section.title && <h4 className="text-sm font-bold text-text">{section.title}</h4>}
            {section.blocks.map((block, blockIndex) => (
              <div key={block.id || blockIndex}>
                {block.type === 'table' && Array.isArray(block.rows) ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-text/70">
                      <tbody className="divide-y divide-slate-100">
                        {block.rows.slice(0, 80).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="min-w-40 px-3 py-2 align-top leading-relaxed">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-text/70">{block.text}</p>
                )}
              </div>
            ))}
          </div>
        ))}

        {blockSections.length === 0 && tables.slice(0, 4).map((table, tableIndex) => (
          <div key={tableIndex} className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-text/70">
              <tbody className="divide-y divide-slate-100">
                {table.slice(0, 80).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="min-w-40 px-3 py-2 align-top leading-relaxed">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {blockSections.length === 0 && tables.length === 0 && questionnaire?.content_text && (
          <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-text/70">
            {questionnaire.content_text}
          </pre>
        )}
      </div>
    </details>
  );
};

const ScorePreview = ({ scoringJson }) => {
  if (!scoringJson) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-900">
      <div className="mb-2 flex items-center gap-2 font-bold">
        <CheckCircle size={17} />
        評分資訊
      </div>
      {scoringJson.total_score?.max !== undefined && (
        <p className="mb-2">總分上限：{scoringJson.total_score.max}</p>
      )}
    </div>
  );
};

const QuestionnaireFormRenderer = ({ questionnaire, answers, onAnswerChange, disabled = false }) => {
  const groups = getQuestionnaireFieldGroups(questionnaire);

  return (
    <div className="space-y-5">
      <ReferenceBlocks questionnaire={questionnaire} />
      <ScorePreview scoringJson={questionnaire?.scoring_json} />

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sky-100 bg-sky-50/40 p-8 text-center text-text/40">
          此問卷目前沒有可填寫欄位
        </div>
      ) : (
        groups.map(group => (
          <section key={group.id} className="space-y-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-primary">{group.title}</h3>
            <div className="grid grid-cols-1 gap-4">
              {group.fields.map(field => (
                <div key={field.id} className="space-y-2">
                  {field.type !== 'acknowledgement' && <FieldLabel field={field} />}
                  <FieldInput
                    field={field}
                    value={answers?.[field.id]}
                    disabled={disabled}
                    onChange={onAnswerChange}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default QuestionnaireFormRenderer;
