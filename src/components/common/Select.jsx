/**
 * WorkLedger - Select Component
 * 
 * Reusable select dropdown component with label, error states,
 * and help text support.
 * 
 * @module components/common/Select
 * @created January 29, 2026
 */

import React from 'react';

/**
 * Select Component
 * 
 * @param {Object} props
 * @param {string} props.label - Select label
 * @param {string} props.id - Select ID (required for accessibility)
 * @param {string} props.name - Select name
 * @param {string} props.value - Selected value
 * @param {Function} props.onChange - Change handler
 * @param {Array} props.options - Array of options [{value, label}]
 * @param {string} props.placeholder - Placeholder option text
 * @param {boolean} props.required - Required field
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.error - Error message
 * @param {string} props.helpText - Help text below select
 * @param {string} props.className - Additional CSS classes
 * 
 * @example
 * <Select
 *   label="Contract Type"
 *   value={contractType}
 *   onChange={(e) => setContractType(e.target.value)}
 *   options={[
 *     { value: 'pmc', label: 'PMC - Preventive Maintenance' },
 *     { value: 'sla', label: 'SLA - Service Level Agreement' }
 *   ]}
 *   error={errors.contractType}
 *   required
 * />
 */
export function Select({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  error = '',
  helpText = '',
  className = '',
  ...props
}) {
  // Generate ID if not provided
  const selectId = id || name || `select-${Math.random().toString(36).substr(2, 9)}`;

  // Select styles
  const baseSelectStyles = `
    block w-full
    px-4 py-2
    border rounded-lg
    bg-white
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:bg-gray-100 disabled:cursor-not-allowed
    transition-colors duration-200
    appearance-none
    cursor-pointer
  `;

  // Conditional styles based on error state
  const conditionalStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500';

  const combinedSelectStyles = `
    ${baseSelectStyles}
    ${conditionalStyles}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Select Wrapper */}
      <div className="relative">
        {/* Select Field */}
        <select
          id={selectId}
          name={name || selectId}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={combinedSelectStyles}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined
          }
          {...props}
        >
          {/* Placeholder Option */}
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {/* Options */}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Dropdown Arrow */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p id={`${selectId}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p id={`${selectId}-help`} className="mt-1 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}

export default Select;
