/**
 * WorkLedger - Forgot Password Page
 * 
 * Password reset page using AuthLayout and ForgotPasswordForm component.
 * 
 * @module pages/auth/ForgotPassword
 * @created January 29, 2026
 */

import React from 'react';
import AuthLayout from '../../components/layout/AuthLayout';
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';

export function ForgotPassword() {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

export default ForgotPassword;
