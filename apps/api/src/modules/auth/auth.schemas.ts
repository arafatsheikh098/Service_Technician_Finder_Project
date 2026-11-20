import { z } from 'zod';

export const password = z
  .string()
  .min(8, 'At least 8 characters')
  // bcrypt silently ignores everything after 72 *bytes*; Bangla characters are 3 bytes each.
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Too long (max 72 bytes)')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number');

const bdPhone = z
  .string()
  .regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number');

export const RegisterCustomerBody = z
  .object({
    role: z.literal('customer'),
    fullName: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    password,
    phone: bdPhone.optional(),
  })
  .meta({ id: 'RegisterCustomer' });

export const RegisterTechnicianBody = z
  .object({
    role: z.literal('technician'),
    fullName: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    password,
    phone: bdPhone,
    profile: z.object({
      bio: z.string().max(1000).optional(),
      experienceYears: z.number().int().min(0).max(60),
      hourlyRateBdt: z.number().int().min(100).max(100000),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      areaLabel: z.string().max(100).optional(),
      serviceRadiusKm: z.number().min(1).max(100).default(10),
      categoryIds: z.array(z.number().int().positive()).min(1).max(10),
    }),
  })
  .meta({ id: 'RegisterTechnician' });

// Admin accounts can never be created through public signup.
export const RegisterBody = z.discriminatedUnion('role', [
  RegisterCustomerBody,
  RegisterTechnicianBody,
]);

export const LoginBody = z
  .object({ email: z.email(), password: z.string().min(1).max(200) })
  .meta({ id: 'Login' });

export const ForgotPasswordBody = z.object({ email: z.email() }).meta({ id: 'ForgotPassword' });
export const ResetPasswordBody = z
  .object({ token: z.string().min(20).max(200), password })
  .meta({ id: 'ResetPassword' });

export const PublicUser = z
  .object({
    id: z.uuid(),
    email: z.string(),
    fullName: z.string(),
    phone: z.string().nullable(),
    role: z.enum(['customer', 'technician', 'admin']),
    avatarUrl: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'User' });

export const AuthResponse = z
  .object({ accessToken: z.string(), user: PublicUser })
  .meta({ id: 'AuthResponse' });
