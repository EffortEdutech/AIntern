/**
 * WorkLedger - Input Component
 * 
 * Reusable input component with label, error states, help text,
 * and various input types support.
 * 
 * @module components/common/Input
 * @created January 29, 2026
 */

import React from 'react';

/**
 * Input Component
 * 
 * @param {Object} props
 * @param {string} props.label - Input label
 * @param {string} props.id - Input ID (required for accessibility)
 * @param {string} props.name - Input name
 * @param {string} props.type - Input type (text, email, password, number, tel, url, date, etc.)
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Change handler
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.required - Required field
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.error - Error message
 * @param {string} props.helpText - Help text below input
 * @param {React.ReactNode} props.leftIcon - Icon on left side
 * @param {React.ReactNode} props.rightIcon - Icon on right side
 * @param {string} props.className - Additional CSS classes
 * 
 * @example
 * <Input
 *   label="Email Address"
 *   type="email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error={errors.email}
 *   required
 * />
 */
export function Input({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error = '',
  helpText = '',
  leftIcon = null,
  rightIcon = null,
  className = '',
  ...props
}) {
  // Generate ID if not provided
  const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;

  // Input wrapper styles
  const wrapperStyles = leftIcon || rightIcon ? 'relative' : '';

  // Input styles
  const baseInputStyles = `
    block w-full
    px-4 py-2
    border rounded-lg
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:bg-gray-100 disabled:cursor-not-allowed
    transition-colors duration-200
  `;

  // Conditional styles based on error state
  const conditionalStyles = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500';

  // Icon padding
  const iconPadding = leftIcon ? 'pl-10' : rightIcon ? 'pr-10' : '';

  const combinedInputStyles = `
    ${baseInputStyles}
    ${conditionalStyles}
    ${iconPadding}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input Wrapper */}
      <div className={wrapperStyles}>
        {/* Left Icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}

        {/* Input Field */}
        <input
          id={inputId}
          name={name || inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={combinedInputStyles}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
          }
          {...props}
        />

        {/* Right Icon */}
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p id={`${inputId}-help`} className="mt-1 text-sm text-gray-500">
          {helpText}
        </p>
      )}
    </div>
  );
}

export default Input;
