import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, Image, Loader2, PenLine, Upload, X } from 'lucide-react';
import { formsApi } from '../api/forms';
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
      scoreLabel: option.score_label,
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

const hasAnswerValue = (field, value) => {
  if (field.type === 'acknowledgement') return value === true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
};

const getClearedValue = (field) => {
  if (field.type === 'multiple_choice') return [];
  if (field.type === 'acknowledgement') return false;
  return '';
};

const isImageField = (field) => field.type === 'signature_image' || field.type === 'drawing_image';

const normalizeRuleText = (value) => String(value || '')
  .replace(/[－—]/g, '–')
  .replace(/\s+/g, ' ')
  .trim();

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numbersEqual = (left, right) => Math.abs(left - right) < 0.000001;

const buildFieldValidationRules = (field) => {
  const validationText = normalizeRuleText(field?.codebook?.validation || field?.validation);
  if (!validationText) return null;

  const isDirectValueRule = /限填|合法分數/.test(validationText);
  const isRecommendedRangeRule = /建議合理範圍/.test(validationText);
  const hasNonNegativeRule = /不得為負值/.test(validationText);
  const hasPositiveRule = /正數/.test(validationText);

  if (!isDirectValueRule && !isRecommendedRangeRule && !hasNonNegativeRule && !hasPositiveRule) {
    return null;
  }

  const ruleSource = validationText.split(/[。；;]/)[0] || validationText;
  const ranges = [];
  const rangePattern = /(-?\d+(?:\.\d+)?)\s*–\s*(-?\d+(?:\.\d+)?)/g;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(ruleSource)) !== null) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      ranges.push({ min, max });
    }
  }

  const withoutRanges = ruleSource.replace(rangePattern, ' ');
  const allowedValues = [];
  if (isDirectValueRule) {
    [...withoutRanges.matchAll(/(?<![A-Za-z])(-?\d+(?:\.\d+)?)(?![A-Za-z])/g)].forEach(match => {
      const value = Number(match[1]);
      if (Number.isFinite(value) && !allowedValues.some(existing => numbersEqual(existing, value))) {
        allowedValues.push(value);
      }
    });
  }

  return {
    source: ruleSource,
    ranges,
    allowedValues,
    min: hasNonNegativeRule ? 0 : null,
    minExclusive: hasPositiveRule ? 0 : null,
    hasOpenNumericRule: hasNonNegativeRule || hasPositiveRule,
  };
};

const isValueInsideRules = (value, rules) => {
  const numericValue = parseNumber(value);
  if (numericValue === null || !rules) return true;

  if (rules.min !== null && numericValue < rules.min) return false;
  if (rules.minExclusive !== null && numericValue <= rules.minExclusive) return false;

  const hasAllowedSet = rules.ranges.length > 0 || rules.allowedValues.length > 0;
  if (!hasAllowedSet) return true;
  if (rules.hasOpenNumericRule && rules.ranges.length === 0) return true;

  return rules.allowedValues.some(allowed => numbersEqual(allowed, numericValue))
    || rules.ranges.some(range => numericValue >= range.min && numericValue <= range.max);
};

const FieldValidationMessage = ({ field, value }) => {
  if (!hasAnswerValue(field, value) || Array.isArray(value) || typeof value === 'object') return null;
  const rules = buildFieldValidationRules(field);
  if (!rules || isValueInsideRules(value, rules)) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-800">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>資料檢核提醒：目前填值不符合此欄規則（{rules.source}）。</span>
    </div>
  );
};

const TextWithBreaks = ({ text }) => String(text ?? '').split(/<br\s*\/?>|\n/i).map((part, index, parts) => (
  <React.Fragment key={`${part}-${index}`}>
    {part}
    {index < parts.length - 1 && <br />}
  </React.Fragment>
));

const FieldLabel = ({ field }) => (
  <div className="space-y-1">
    <label htmlFor={field.id} className="block text-sm font-bold leading-relaxed text-text/80">
      <TextWithBreaks text={field.label || field.id} />
      {field.required && <span className="ml-1 text-rose-500">*</span>}
    </label>
    {field.unit && (
      <p className="text-xs font-medium text-text/45">單位：{field.unit}</p>
    )}
  </div>
);

const normalizeReferenceImages = (source) => {
  if (!source) return [];
  const images = Array.isArray(source) ? source : [source];
  return images
    .map((image) => {
      if (!image) return null;
      if (typeof image === 'string') return { src: image };
      return {
        src: image.src || image.url || image.path,
        alt: image.alt || image.label || image.title,
        caption: image.caption || image.label || image.title,
        maxHeight: image.maxHeight || image.max_height,
      };
    })
    .filter(image => image?.src);
};

const ReferenceImages = ({ images, compact = false }) => {
  const normalizedImages = normalizeReferenceImages(images);
  if (normalizedImages.length === 0) return null;

  return (
    <div className={`grid gap-3 ${normalizedImages.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : ''}`}>
      {normalizedImages.map((image, index) => (
        <figure
          key={`${image.src}-${index}`}
          className="overflow-hidden rounded-xl border border-sky-100 bg-slate-50/70 p-2"
        >
          <img
            src={image.src}
            alt={image.alt || image.caption || '問卷題目圖'}
            className="mx-auto w-full object-contain"
            style={{ maxHeight: image.maxHeight || (compact ? 180 : 360) }}
            loading="lazy"
          />
          {image.caption && (
            <figcaption className="mt-2 text-center text-xs font-bold text-text/50">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
};

const ImageFieldInput = ({ field, value, disabled, responseId, isPreparingResponse, onAssetUpload, onAssetClear }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const assetId = value?.asset_id;

  useEffect(() => {
    if (!assetId) {
      setPreviewUrl(null);
      return undefined;
    }
    let revokedUrl = null;
    let isMounted = true;
    formsApi.downloadAsset(assetId)
      .then(blob => {
        if (!isMounted) return;
        revokedUrl = URL.createObjectURL(blob);
        setPreviewUrl(revokedUrl);
      })
      .catch(() => {
        if (isMounted) setPreviewUrl(null);
      });
    return () => {
      isMounted = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [assetId]);

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const beginStroke = (event) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getCanvasPoint(event);
    drawingRef.current = true;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = field.type === 'signature_image' ? 3 : 2;
    context.strokeStyle = '#0f172a';
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawStroke = (event) => {
    if (!drawingRef.current || disabled) return;
    event.preventDefault();
    const context = canvasRef.current.getContext('2d');
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasInk(true);
  };

  const endStroke = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const uploadFile = async (file) => {
    if (disabled || !file) return;
    setIsBusy(true);
    try {
      await onAssetUpload(field, file);
      clearCanvas();
    } finally {
      setIsBusy(false);
    }
  };

  const uploadCanvas = async () => {
    if (!hasInk || disabled) return;
    const canvas = canvasRef.current;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `${field.id}.png`, { type: 'image/png' });
    await uploadFile(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) uploadFile(file);
  };

  return (
    <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
      {previewUrl ? (
        <div className="overflow-hidden rounded-lg border border-sky-100 bg-white">
          <img src={previewUrl} alt={field.label || field.id} className="max-h-64 w-full object-contain" />
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-sky-200 bg-white text-sm font-bold text-text/35">
          <Image size={18} className="mr-2" />
          尚未上傳圖片
        </div>
      )}

      {!disabled && (
        <>
          <canvas
            ref={canvasRef}
            width={720}
            height={field.type === 'signature_image' ? 220 : 420}
            className="h-44 w-full touch-none rounded-lg border border-slate-200 bg-white"
            onPointerDown={beginStroke}
            onPointerMove={drawStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={uploadCanvas}
              disabled={!hasInk || isBusy || isPreparingResponse}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
              使用手寫圖
            </button>
            <label className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-primary ${isBusy || isPreparingResponse ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <Upload size={15} />
              上傳圖片
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={isBusy || isPreparingResponse}
                onChange={handleFileChange}
              />
            </label>
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!hasInk || isBusy}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-text/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              清空畫布
            </button>
            {assetId && (
              <button
                type="button"
                onClick={() => onAssetClear(field, assetId)}
                disabled={isBusy}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={15} />
                移除圖片
              </button>
            )}
          </div>
          {!responseId && (
            <p className="text-xs font-bold text-amber-700">
              {isPreparingResponse ? '正在建立草稿，完成後即可上傳或使用手寫圖。' : '第一次使用圖片欄位時會自動建立草稿。'}
            </p>
          )}
        </>
      )}
    </div>
  );
};

const FieldInput = ({ field, value, onChange, disabled, responseId, isPreparingResponse, onAssetUpload, onAssetClear }) => {
  const options = getFieldOptions(field);

  if (isImageField(field)) {
    return (
      <ImageFieldInput
        field={field}
        value={value}
        disabled={disabled}
        responseId={responseId}
        isPreparingResponse={isPreparingResponse}
        onAssetUpload={onAssetUpload}
        onAssetClear={onAssetClear}
      />
    );
  }

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
            onClick={() => onChange(field.id, value === option.value ? '' : option.value)}
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
        {options.map(option => {
          const selected = String(value ?? '') === option.value;
          return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(field.id, selected ? '' : option.value)}
            className={`flex w-full min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-100 ${
              selected
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-sky-100 bg-white text-text/70 hover:border-primary/30'
            }`}
          >
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              selected ? 'border-primary' : 'border-slate-300'
            }`}>
              {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span className="flex-1 leading-relaxed">
              {option.label}
              {option.score !== undefined && (
                <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-text/45">
                  {option.scoreLabel ?? `${option.score} 分`}
                </span>
              )}
            </span>
          </button>
        );
        })}
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
        onWheel={(event) => event.currentTarget.blur()}
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

const QuestionnaireFormRenderer = ({
  questionnaire,
  answers,
  onAnswerChange,
  disabled = false,
  responseId = null,
  isPreparingResponse = false,
  onAssetUpload = async () => {},
  onAssetClear = () => {},
}) => {
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
            <ReferenceImages images={group.referenceImage || group.referenceImages} />
            <div className="grid grid-cols-1 gap-4">
              {group.fields.map(field => (
                <div key={field.id} className="space-y-2">
                  <ReferenceImages images={field.image || field.images || field.reference_image || field.referenceImages} compact />
                  <div className="flex items-start justify-between gap-3">
                    {field.type !== 'acknowledgement' ? <FieldLabel field={field} /> : <div />}
                    {!disabled && !isImageField(field) && hasAnswerValue(field, answers?.[field.id]) && (
                      <button
                        type="button"
                        onClick={() => onAnswerChange(field.id, getClearedValue(field))}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-text/45 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X size={13} />
                        清除
                      </button>
                    )}
                  </div>
                  <FieldInput
                    field={field}
                    value={answers?.[field.id]}
                    disabled={disabled}
                    responseId={responseId}
                    isPreparingResponse={isPreparingResponse}
                    onAssetUpload={onAssetUpload}
                    onAssetClear={onAssetClear}
                    onChange={onAnswerChange}
                  />
                  <FieldValidationMessage field={field} value={answers?.[field.id]} />
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
