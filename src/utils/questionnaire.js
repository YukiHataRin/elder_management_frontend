const normalizeSchema = (questionnaireOrSchema) => questionnaireOrSchema?.schema_json || questionnaireOrSchema || {};

export const getQuestionnaireFieldGroups = (questionnaireOrSchema) => {
  const schema = normalizeSchema(questionnaireOrSchema);
  const groups = [];

  if (Array.isArray(schema.common_fields) && schema.common_fields.length > 0) {
    groups.push({
      id: 'common_fields',
      title: '基本資料',
      fields: schema.common_fields,
    });
  }

  if (Array.isArray(schema.fields) && schema.fields.length > 0) {
    groups.push({
      id: 'root_fields',
      title: '問卷內容',
      fields: schema.fields,
    });
  }

  if (Array.isArray(schema.sections)) {
    schema.sections.forEach((section, index) => {
      if (Array.isArray(section.fields) && section.fields.length > 0) {
        groups.push({
          id: section.code || section.id || `section_${index}`,
          title: section.title || section.code || `第 ${index + 1} 區`,
          fields: section.fields,
        });
      }
    });
  }

  return groups;
};

export const getQuestionnaireFields = (questionnaireOrSchema) => (
  getQuestionnaireFieldGroups(questionnaireOrSchema).flatMap(group => group.fields)
);
