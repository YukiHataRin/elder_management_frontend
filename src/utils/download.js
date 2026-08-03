export const sanitizeFilename = (value) => (
  String(value || 'download')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
);

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const buildQuestionnaireXlsxFilename = ({
  subjectName,
  subjectNationId,
  templateTitle,
  submittedAt,
}) => {
  const dateText = submittedAt ? new Date(submittedAt).toISOString().slice(0, 10).replaceAll('-', '') : null;
  const parts = [
    subjectName || '個案',
    subjectNationId || '未填身分證字號',
    templateTitle || '問卷',
    dateText,
  ].filter(Boolean);

  return `${sanitizeFilename(parts.join('_'))}.xlsx`;
};
