/**
 * WorkLedger - Login Page
 * 
 * Login page using AuthLayout and LoginForm component.
 * 
 * @module pages/auth/Login
 * @created January 29, 2026
 */

import React from 'react';
import AuthLayout from '../../components/layout/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';

export function Login() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}

export default Login;
