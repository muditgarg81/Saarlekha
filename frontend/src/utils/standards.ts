export interface FormatField {
  name: string;
  type: string;
  unit?: string;
  open?: boolean;
  options?: string[];
  formula?: {
    left: string;
    operator: string;
    right: string;
  };
  carryBaseType?: 'text' | 'number' | 'date';
  carrySourceFieldId?: string;
  carryScope?: 'machine' | 'field' | 'overall';
  carryScopeFieldId?: string;
}

export const REPORT_STANDARD_FIELDS: FormatField[] = [
  { name: 'Date', type: 'date' },
  { name: 'Department', type: 'department' },
  { name: 'Logged By', type: 'text' }
];

export const JOB_ORDER_STANDARD_FIELDS: FormatField[] = [
  { name: 'Order Number', type: 'text' },
  { name: 'Customer', type: 'client' },
  { name: 'Department', type: 'department' },
  { name: 'Item Description', type: 'item' },
  { name: 'Start Date', type: 'date' },
  { name: 'End/Target Date', type: 'date' },
  { name: 'Status', type: 'text' },
  { name: 'Order Qty', type: 'number' },
  { name: 'Order Units', type: 'text' },
  { name: 'Production Qty', type: 'number' },
  { name: 'Production Units', type: 'text' }
];

export const MAINTENANCE_STANDARD_FIELDS: FormatField[] = [
  { name: 'Maintenance Date', type: 'date' },
  { name: 'Machine', type: 'machine' },
  { name: 'Maintenance Type', type: 'text' },
  { name: 'Status', type: 'text' }
];

export const getStandardFieldsForType = (formatType: string): FormatField[] => {
  const typeUpper = formatType.toUpperCase();
  if (typeUpper === 'JOB_ORDER') return JOB_ORDER_STANDARD_FIELDS;
  if (typeUpper === 'MAINTENANCE') return MAINTENANCE_STANDARD_FIELDS;
  return REPORT_STANDARD_FIELDS;
};

export const isStandardField = (name: string, formatType: string): boolean => {
  const standards = getStandardFieldsForType(formatType);
  const normalized = name.toLowerCase().trim();
  return standards.some(f => f.name.toLowerCase().trim() === normalized);
};

export const injectStandardFields = (schema: FormatField[] = [], formatType: string): FormatField[] => {
  const standards = getStandardFieldsForType(formatType);
  const currentFields = Array.isArray(schema) ? schema : [];
  
  // Find standard fields already present in the schema (matching case-insensitively)
  const presentStandards = currentFields.filter(f => 
    standards.some(sf => sf.name.toLowerCase().trim() === f.name.toLowerCase().trim())
  );
  
  // Find standards that are missing
  const missingStandards = standards.filter(sf => 
    !currentFields.some(f => f.name.toLowerCase().trim() === sf.name.toLowerCase().trim())
  );
  
  // Prepend missing standard fields at the beginning in their default order
  return [...missingStandards, ...currentFields];
};
