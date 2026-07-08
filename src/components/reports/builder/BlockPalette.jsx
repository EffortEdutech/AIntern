/**
 * WorkLedger - Block Palette Component
 * 
 * Displays all available block types that can be dragged
 * into the layout canvas.
 * 
 * @component
 * @created February 12, 2026 - Session 7
 */

import { BLOCK_TYPES } from '../../../services/api/layoutService';

export default function BlockPalette({ onAddBlock }) {
  /**
   * Handle drag start
   */
  const handleDragStart = (e, blockType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('blockType', blockType.type);
    e.dataTransfer.setData('text/plain', blockType.label);
  };

  /**
   * Create new section from block type
   */
  const handleAddClick = (blockType) => {
    const newSection = {
      section_id: `section_${Date.now()}`,
      block_type: blockType.type,
      content: blockType.defaultContent || {},
      binding_rules: {},
      options: blockType.defaultOptions || {}
    };
    onAddBlock(newSection);
  };

  return (
    <div className="bg-white border-r border-gray-200 w-64 p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 mb-1">Block Palette</h3>
        <p className="text-xs text-gray-600">
          Drag blocks to canvas or click to add
        </p>
      </div>

      {/* Block List */}
      <div className="space-y-2">
        {BLOCK_TYPES.map((blockType) => (
          <BlockCard
            key={blockType.type}
            blockType={blockType}
            onDragStart={handleDragStart}
            onAddClick={handleAddClick}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual Block Card
 */
function BlockCard({ blockType, onDragStart, onAddClick }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, blockType)}
      onClick={() => onAddClick(blockType)}
      className="bg-gray-50 border border-gray-300 rounded-lg p-3 cursor-move hover:bg-blue-50 hover:border-blue-400 transition-colors group"
    >
      {/* Icon & Label */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{blockType.icon}</span>
        <span className="font-medium text-sm text-gray-900">
          {blockType.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600">
        {blockType.description}
      </p>

      {/* Drag hint */}
      <div className="mt-2 text-xs text-gray-400 group-hover:text-blue-600">
        ⤴ Drag or click to add
      </div>
    </div>
  );
}
