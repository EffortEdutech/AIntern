/**
 * WorkLedger - Layout Canvas Component
 * 
 * Preview area where sections are displayed and can be
 * reordered via arrow buttons (⬆️⬇️).
 * 
 * @component
 * @created February 12, 2026 - Session 7
 * @updated February 17, 2026 - Session 8: Added arrow buttons, removed drag
 */

export default function LayoutCanvas({ 
  sections, 
  onSelectSection,
  selectedSectionIndex,
  onSectionMove,
  onSectionRemove  // ← Changed from onSectionsChange
}) {
  /**
   * Handle drop from palette
   * NOTE: Disabled - use BlockPalette onClick instead
   */
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    // Drag from palette is disabled - use click on blocks instead
  };

  /**
   * Handle section reorder via drag
   * NOTE: Disabled - use ⬆️⬇️ arrow buttons instead
   */
  const handleSectionDrop = (e, dropIndex) => {
    e.preventDefault();
    // Drag reordering is disabled - use arrow buttons instead
  };

  /**
   * Handle section drag start
   * NOTE: Disabled
   */
  const handleSectionDragStart = (e, index) => {
    e.preventDefault();
  };

  /**
   * Handle drag over
   * NOTE: Disabled
   */
  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDragLeave = () => {
    // No-op
  };

  /**
   * Move section up or down
   */
  const handleMoveUp = (index) => {
    if (index === 0) {
      return;
    } // Already at top
    if (onSectionMove) {
      onSectionMove(index, index - 1);
    }
  };

  const handleMoveDown = (index) => {
    if (index === sections.length - 1) {
      return;
    } // Already at bottom
    if (onSectionMove) {
      onSectionMove(index, index + 1);
    }
  };

  /**
   * Remove section
   */
  const handleRemove = (index) => {
    if (!confirm('Remove this section?')) {
      return;
    }
    
    // Call the parent's remove handler with the index
    if (onSectionRemove) {
      onSectionRemove(index);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 p-6 overflow-y-auto">
      {/* Canvas Header */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-1">Layout Canvas</h3>
        <p className="text-sm text-gray-600">
          {sections.length} sections • Use ⬆️⬇️ to reorder
        </p>
      </div>

      {/* Empty State */}
      {sections.length === 0 && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-white"
        >
          <div className="text-4xl mb-3">📄</div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            Empty Canvas
          </h4>
          <p className="text-gray-600 mb-4">
            Click blocks in the palette to add sections to your layout
          </p>
          <div className="text-sm text-gray-500">
            Use ⬆️⬇️ arrows to reorder sections
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <SectionCard
              key={index}
              section={section}
              index={index}
              isSelected={index === selectedSectionIndex}
              onSelect={() => onSelectSection(index)}
              onRemove={() => handleRemove(index)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Section Card Component
 */
function SectionCard({ 
  section, 
  index, 
  isSelected,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}) {
  // Get block type info
  const blockTypeInfo = {
    header: { icon: '📌', color: 'blue' },
    detail_entry: { icon: '📋', color: 'green' },
    text_section: { icon: '📝', color: 'yellow' },
    checklist: { icon: '✅', color: 'purple' },
    table: { icon: '📊', color: 'indigo' },
    photo_grid: { icon: '📷', color: 'pink' },
    signature_box: { icon: '✍️', color: 'orange' },
    metrics_cards: { icon: '📈', color: 'teal' }
  }[section.block_type] || { icon: '📦', color: 'gray' };

  return (
    <div
      draggable={false}
      onClick={onSelect}
      className={`
        bg-white rounded-lg border-2 p-4 cursor-pointer
        transition-all
        ${isSelected 
      ? 'border-blue-500 shadow-lg ring-2 ring-blue-200' 
      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
    }
      `}
    >
      <div className="flex items-center justify-between">
        {/* Section Info */}
        <div className="flex items-center gap-3">
          {/* Icon & Name */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{blockTypeInfo.icon}</span>
            <div>
              <div className="font-medium text-gray-900">
                {section.section_id}
              </div>
              <div className="text-sm text-gray-600">
                {section.block_type.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Selected Badge */}
          {isSelected && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Selected
            </span>
          )}

          {/* Move Up Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={isFirst}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            ⬆️
          </button>

          {/* Move Down Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={isLast}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            ⬇️
          </button>

          {/* Remove Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            title="Remove section"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Section Preview */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <SectionPreview section={section} />
      </div>
    </div>
  );
}

/**
 * Section Preview (shows what the section contains)
 */
function SectionPreview({ section }) {
  return (
    <div className="text-sm text-gray-600">
      {/* Header Block */}
      {section.block_type === 'header' && (
        <div>
          <div className="font-medium">
            {section.content?.title || 'Work Report'}
          </div>
          {section.content?.subtitle && (
            <div className="text-xs">{section.content.subtitle}</div>
          )}
        </div>
      )}

      {/* Other Blocks */}
      {section.block_type !== 'header' && (
        <div className="flex items-center gap-2">
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            {Object.keys(section.options || {}).length} options
          </span>
          <span className="text-xs text-gray-500">
            {Object.keys(section.binding_rules || {}).length} bindings
          </span>
        </div>
      )}
    </div>
  );
}
