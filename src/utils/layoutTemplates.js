/**
 * WorkLedger - Layout Templates Library
 * 
 * Pre-built layout templates that users can clone and customize.
 * Provides common layout patterns for different use cases.
 * 
 * @module
 * @created February 12, 2026 - Session 8
 */

/**
 * Layout Template Definitions
 */
export const LAYOUT_TEMPLATES = [
  {
    id: 'minimal_report',
    name: 'Minimal Report',
    description: 'Simple, clean layout with essential information only',
    icon: '📄',
    category: 'basic',
    compatible_types: ['PMC', 'CMC', 'AMC', 'CORRECTIVE'],
    schema: {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      },
      sections: [
        {
          section_id: 'header',
          block_type: 'header',
          content: {
            title: 'Work Report',
            subtitle: 'Maintenance Activity'
          },
          binding_rules: {},
          options: {}
        },
        {
          section_id: 'details',
          block_type: 'detail_entry',
          content: {},
          binding_rules: {
            source: 'entry.data'
          },
          options: {
            columns: 2,
            layout: 'two_column'
          }
        },
        {
          section_id: 'observations',
          block_type: 'text_section',
          content: {},
          binding_rules: {
            source: 'entry.observations'
          },
          options: {
            title: 'Observations'
          }
        }
      ]
    }
  },
  
  {
    id: 'photo_focused',
    name: 'Photo-Focused Report',
    description: 'Emphasizes visual evidence with large photo grid',
    icon: '📷',
    category: 'visual',
    compatible_types: ['PMC', 'CMC', 'CORRECTIVE', 'EMERGENCY'],
    schema: {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: { top: 15, bottom: 15, left: 15, right: 15 }
      },
      sections: [
        {
          section_id: 'header',
          block_type: 'header',
          content: {
            title: 'Visual Inspection Report'
          },
          binding_rules: {},
          options: {}
        },
        {
          section_id: 'summary',
          block_type: 'metrics_cards',
          content: {},
          binding_rules: {},
          options: {
            columns: 3
          }
        },
        {
          section_id: 'photo_evidence',
          block_type: 'photo_grid',
          content: {},
          binding_rules: {
            source: 'attachments',
            filter: { file_type: 'photo' }
          },
          options: {
            columns: 3,
            showTimestamps: true,
            showCaptions: true
          }
        },
        {
          section_id: 'notes',
          block_type: 'text_section',
          content: {},
          binding_rules: {},
          options: {
            title: 'Additional Notes'
          }
        },
        {
          section_id: 'signatures',
          block_type: 'signature_box',
          content: {},
          binding_rules: {
            source: 'attachments',
            filter: { file_type: 'signature' }
          },
          options: {
            title: 'Signatures'
          }
        }
      ]
    }
  },
  
  {
    id: 'comprehensive',
    name: 'Comprehensive Report',
    description: 'Detailed report with all sections for thorough documentation',
    icon: '📊',
    category: 'detailed',
    compatible_types: ['PMC', 'CMC', 'AMC', 'SLA'],
    schema: {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      },
      sections: [
        {
          section_id: 'header',
          block_type: 'header',
          content: {
            title: 'Comprehensive Maintenance Report'
          },
          binding_rules: {},
          options: {}
        },
        {
          section_id: 'summary_metrics',
          block_type: 'metrics_cards',
          content: {},
          binding_rules: {},
          options: {
            columns: 3
          }
        },
        {
          section_id: 'basic_info',
          block_type: 'detail_entry',
          content: {},
          binding_rules: {
            source: 'entry.data'
          },
          options: {
            columns: 2,
            layout: 'two_column'
          }
        },
        {
          section_id: 'checklist',
          block_type: 'checklist',
          content: {},
          binding_rules: {},
          options: {
            showStatus: true
          }
        },
        {
          section_id: 'equipment_table',
          block_type: 'table',
          content: {},
          binding_rules: {},
          options: {
            showHeaders: true
          }
        },
        {
          section_id: 'observations',
          block_type: 'text_section',
          content: {},
          binding_rules: {},
          options: {
            title: 'Detailed Observations'
          }
        },
        {
          section_id: 'photos',
          block_type: 'photo_grid',
          content: {},
          binding_rules: {
            source: 'attachments',
            filter: { file_type: 'photo' }
          },
          options: {
            columns: 2,
            showTimestamps: true,
            showCaptions: true
          }
        },
        {
          section_id: 'signatures',
          block_type: 'signature_box',
          content: {},
          binding_rules: {
            source: 'attachments',
            filter: { file_type: 'signature' }
          },
          options: {
            title: 'Approvals'
          }
        }
      ]
    }
  },
  
  {
    id: 'checklist_focused',
    name: 'Checklist Report',
    description: 'Task-oriented layout focused on completion tracking',
    icon: '✅',
    category: 'task',
    compatible_types: ['PMC', 'CORRECTIVE', 'CONSTRUCTION'],
    schema: {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      },
      sections: [
        {
          section_id: 'header',
          block_type: 'header',
          content: {
            title: 'Task Completion Report'
          },
          binding_rules: {},
          options: {}
        },
        {
          section_id: 'summary',
          block_type: 'metrics_cards',
          content: {},
          binding_rules: {},
          options: {
            columns: 3
          }
        },
        {
          section_id: 'task_checklist',
          block_type: 'checklist',
          content: {},
          binding_rules: {},
          options: {
            showStatus: true
          }
        },
        {
          section_id: 'equipment_used',
          block_type: 'table',
          content: {},
          binding_rules: {},
          options: {
            showHeaders: true
          }
        },
        {
          section_id: 'notes',
          block_type: 'text_section',
          content: {},
          binding_rules: {},
          options: {
            title: 'Additional Notes'
          }
        },
        {
          section_id: 'verification',
          block_type: 'signature_box',
          content: {},
          binding_rules: {},
          options: {
            title: 'Verification'
          }
        }
      ]
    }
  },
  
  {
    id: 'sla_report',
    name: 'SLA Report',
    description: 'Service Level Agreement tracking with response times',
    icon: '⏱️',
    category: 'sla',
    compatible_types: ['SLA', 'EMERGENCY'],
    schema: {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      },
      sections: [
        {
          section_id: 'header',
          block_type: 'header',
          content: {
            title: 'SLA Compliance Report'
          },
          binding_rules: {},
          options: {}
        },
        {
          section_id: 'sla_metrics',
          block_type: 'metrics_cards',
          content: {},
          binding_rules: {},
          options: {
            columns: 4
          }
        },
        {
          section_id: 'incident_details',
          block_type: 'detail_entry',
          content: {},
          binding_rules: {},
          options: {
            columns: 2,
            layout: 'two_column'
          }
        },
        {
          section_id: 'timeline_table',
          block_type: 'table',
          content: {},
          binding_rules: {},
          options: {
            showHeaders: true
          }
        },
        {
          section_id: 'resolution',
          block_type: 'text_section',
          content: {},
          binding_rules: {},
          options: {
            title: 'Resolution Details'
          }
        },
        {
          section_id: 'evidence',
          block_type: 'photo_grid',
          content: {},
          binding_rules: {},
          options: {
            columns: 2,
            showTimestamps: true,
            showCaptions: false
          }
        },
        {
          section_id: 'sign_off',
          block_type: 'signature_box',
          content: {},
          binding_rules: {},
          options: {
            title: 'Sign-off'
          }
        }
      ]
    }
  },
  
  {
    id: 'daily_diary',
    name: 'Daily Diary',
    description: 'Construction/maintenance daily activity log',
    icon: '📅',
    category: 'daily',
    compatible_types: ['CONSTRUCTION', 'T_AND_M'],
    schema: {
      page: {
        size: 'A4',
        orientation: 'landscape',
        margins: { top: 15, bottom: 15, left: 15, right: 15 }
      },
      sections: [
        {
          section_id: 'header',
          block_type: 'header',
          content: {
            title: 'Daily Activity Diary'
          },
          binding_rules: {},
          options: {}
        },
        {
          section_id: 'day_summary',
          block_type: 'detail_entry',
          content: {},
          binding_rules: {},
          options: {
            columns: 3,
            layout: 'two_column'
          }
        },
        {
          section_id: 'activities',
          block_type: 'table',
          content: {},
          binding_rules: {},
          options: {
            showHeaders: true
          }
        },
        {
          section_id: 'weather_conditions',
          block_type: 'text_section',
          content: {},
          binding_rules: {},
          options: {
            title: 'Weather & Site Conditions'
          }
        },
        {
          section_id: 'site_photos',
          block_type: 'photo_grid',
          content: {},
          binding_rules: {},
          options: {
            columns: 4,
            showTimestamps: true,
            showCaptions: true
          }
        },
        {
          section_id: 'remarks',
          block_type: 'text_section',
          content: {},
          binding_rules: {},
          options: {
            title: 'Remarks'
          }
        }
      ]
    }
  }
];

/**
 * Template categories
 */
export const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All Templates', icon: '📚' },
  { id: 'basic', label: 'Basic', icon: '📄' },
  { id: 'visual', label: 'Visual', icon: '📷' },
  { id: 'detailed', label: 'Detailed', icon: '📊' },
  { id: 'task', label: 'Task-Oriented', icon: '✅' },
  { id: 'sla', label: 'SLA & Emergency', icon: '⏱️' },
  { id: 'daily', label: 'Daily Logs', icon: '📅' }
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(categoryId) {
  if (categoryId === 'all') {
    return LAYOUT_TEMPLATES;
  }
  return LAYOUT_TEMPLATES.filter(t => t.category === categoryId);
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId) {
  return LAYOUT_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get templates by compatible type
 */
export function getTemplatesByType(templateType) {
  return LAYOUT_TEMPLATES.filter(t => 
    t.compatible_types.includes(templateType)
  );
}
