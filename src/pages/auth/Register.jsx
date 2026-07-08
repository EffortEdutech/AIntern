/**
 * WorkLedger - Register Page
 * 
 * Registration page using AuthLayout and RegisterForm component.
 * 
 * @module pages/auth/Register
 * @created January 29, 2026
 */

import React from 'react';
import AuthLayout from '../../components/layout/AuthLayout';
import RegisterForm from '../../components/auth/RegisterForm';

export function Register() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}

export default Register;
