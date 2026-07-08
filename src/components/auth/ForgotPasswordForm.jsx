/**
 * WorkLedger - Forgot Password Form Component
 * 
 * Password reset request form with email validation
 * and success confirmation.
 * 
 * @module components/auth/ForgotPasswordForm
 * @created January 29, 2026
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';

export function ForgotPasswordForm() {
  const { resetPassword, loading } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  /**
   * Handle input change
   */
  const handleChange = (e) => {
    setEmail(e.target.value);
    
    // Clear errors
    if (errors.email) {
      setErrors({});
    }
    if (submitError) {
      setSubmitError('');
    }
  };

  /**
   * Validate form
   */
  const validate = () => {
    const newErrors = {};

    // Email validation
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submit
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous states
    setSubmitError('');
    setSubmitSuccess(false);

    // Validate form
    if (!validate()) {
      return;
    }

    console.log('📝 ForgotPasswordForm: Requesting reset for', email);

    // Request password reset
    const result = await resetPassword(email);

    if (result.success) {
      console.log('✅ ForgotPasswordForm: Reset email sent');
      setSubmitSuccess(true);
      setEmail(''); // Clear email field
    } else {
      console.error('❌ ForgotPasswordForm: Reset failed:', result.error);
      setSubmitError(result.error || 'Failed to send reset email. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reset Password
        </h1>
        <p className="text-gray-600">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success Message */}
        {submitSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Reset link sent!
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    If an account exists with that email address, you'll receive a password reset link shortly.
                    Please check your inbox and spam folder.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              ❌ {submitError}
            </p>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={handleChange}
            disabled={loading}
            className={`
              input w-full
              ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            `}
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <span className="spinner mr-2"></span>
              Sending reset link...
            </span>
          ) : (
            'Send Reset Link'
          )}
        </button>

        {/* Back to Login */}
        <div className="text-center">
          <Link
            to={ROUTES.LOGIN}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            ← Back to login
          </Link>
        </div>
      </form>

      {/* Additional Help */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          Need help?
        </h4>
        <p className="text-sm text-blue-700">
          If you're having trouble resetting your password, please contact your organization administrator or{' '}
          <a href="mailto:support@workledger.com" className="underline">
            support@workledger.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordForm;
