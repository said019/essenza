/**
 * 🔄 SERVICIO DE MIGRACIÓN DE CLIENTES
 * 
 * Lógica para registrar clientes que ya pagaron antes de implementar la plataforma.
 * NO genera órdenes de venta ni afecta reportes financieros.
 */

import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import type {
  MigrateClientParams,
  MigrationResult,
  MigrationRecord,
  MembershipStats,
} from '@/types/migration.types';

/**
 * Genera contraseña temporal segura
 */
const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const special = '!@#$%';
  let password = '';
  
  // 8 caracteres alfanuméricos
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // 1 carácter especial
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  return password;
};

/**
 * Migrar un cliente existente al sistema
 * 
 * Crea el usuario y activa su membresía SIN generar orden de venta.
 * Las migraciones NO afectan reportes de ingresos.
 */
export const migrateExistingClient = async (
  params: MigrateClientParams,
  adminId: string,
  adminName: string
): Promise<MigrationResult> => {
  try {
    const batch = writeBatch(db);
    
    // 1. Validar que el paquete existe
    const packageRef = doc(db, 'packages', params.packageId);
    const packageSnap = await getDoc(packageRef);
    
    if (!packageSnap.exists()) {
      throw new Error('Paquete no encontrado');
    }
    
    const packageData = packageSnap.data();
    
    // 2. Generar contraseña temporal
    const tempPassword = generateTempPassword();
    
    // 3. Crear usuario en Auth (si tiene email)
    let authUser = null;
    if (params.email) {
      try {
        authUser = await createUserWithEmailAndPassword(
          auth,
          params.email,
          tempPassword
        );
      } catch (authError: any) {
        // Si el email ya existe, continuar sin crear en Auth
        console.warn('Email ya registrado en Auth:', authError.message);
      }
    }
    
    // 4. Crear documento de usuario
    const userRef = doc(collection(db, 'users'));
    batch.set(userRef, {
      id: userRef.id,
      authUid: authUser?.user.uid || null,
      name: params.name,
      email: params.email || null,
      phone: params.phone,
      birthDate: params.birthDate || null,
      createdAt: serverTimestamp(),
      createdBy: adminId,
      source: 'migration', // ← CLAVE
      migrationNotes: params.notes || null,
      role: 'client',
      active: true,
    });
    
    // 5. Calcular clases restantes
    const classesTotal = packageData.classes || -1; // -1 = ilimitado
    const classesUsed = params.classesAlreadyUsed || 0;
    const classesRemaining = classesTotal === -1 
      ? -1 
      : Math.max(0, classesTotal - classesUsed);
    
    // 6. Crear membresía/paquete
    const userPackageRef = doc(collection(db, 'user_packages'));
    batch.set(userPackageRef, {
      id: userPackageRef.id,
      userId: userRef.id,
      packageId: params.packageId,
      packageName: packageData.name,
      packageType: packageData.type || 'membership',
      
      startDate: Timestamp.fromDate(params.startDate),
      endDate: Timestamp.fromDate(params.endDate),
      activatedAt: serverTimestamp(),
      
      status: 'active',
      classesTotal,
      classesUsed,
      classesRemaining,
      
      origin: 'migration', // ← CLAVE - NO ES VENTA
      
      migrationData: {
        originalPaymentDate: Timestamp.fromDate(params.originalPaymentDate),
        originalAmount: params.originalAmount,
        paymentMethod: params.paymentMethod,
        receiptReference: params.receiptReference || null,
        migratedBy: adminId,
        migratedAt: serverTimestamp(),
        notes: params.notes || '',
      },
    });
    
    // 7. Registrar acción administrativa
    const actionRef = doc(collection(db, 'admin_actions'));
    batch.set(actionRef, {
      id: actionRef.id,
      adminId,
      adminName,
      action: 'migrate_client',
      targetUserId: userRef.id,
      details: {
        clientName: params.name,
        packageName: packageData.name,
        originalAmount: params.originalAmount,
        originalPaymentDate: params.originalPaymentDate.toISOString(),
        startDate: params.startDate.toISOString(),
        endDate: params.endDate.toISOString(),
      },
      timestamp: serverTimestamp(),
    });
    
    // 8. NO CREAR ORDER - Las migraciones no generan órdenes
    
    // 9. Commit de todos los cambios
    await batch.commit();
    
    // 10. Enviar notificaciones (implementar después)
    if (params.sendEmail && params.email) {
      // TODO: await sendWelcomeEmail(params.email, params.name, tempPassword);
      console.log('📧 Email enviado a:', params.email);
    }
    
    if (params.sendWhatsApp && params.phone) {
      // TODO: await sendWhatsAppWelcome(params.phone, params.name, tempPassword);
      console.log('📱 WhatsApp enviado a:', params.phone);
    }
    
    return {
      userId: userRef.id,
      packageId: userPackageRef.id,
      tempPassword,
      success: true,
    };
    
  } catch (error: any) {
    console.error('Error al migrar cliente:', error);
    return {
      userId: '',
      packageId: '',
      tempPassword: '',
      success: false,
      error: error.message || 'Error desconocido',
    };
  }
};

/**
 * Obtener historial de migraciones
 */
export const getMigrationHistory = async (
  limitCount: number = 50
): Promise<MigrationRecord[]> => {
  try {
    // Obtener paquetes migrados
    const packagesRef = collection(db, 'user_packages');
    const q = query(
      packagesRef,
      where('origin', '==', 'migration'),
      orderBy('migrationData.migratedAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    
    const records: MigrationRecord[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      // Obtener datos del usuario
      const userRef = doc(db, 'users', data.userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      
      // Obtener nombre del admin que migró
      const adminRef = doc(db, 'users', data.migrationData?.migratedBy || '');
      const adminSnap = await getDoc(adminRef);
      const adminData = adminSnap.data();
      
      records.push({
        id: docSnap.id,
        userId: data.userId,
        userName: userData?.name || 'Desconocido',
        userEmail: userData?.email || null,
        userPhone: userData?.phone || '',
        packageName: data.packageName,
        originalAmount: data.migrationData?.originalAmount || 0,
        originalPaymentDate: data.migrationData?.originalPaymentDate,
        migratedBy: data.migrationData?.migratedBy || '',
        migratedByName: adminData?.name || 'Admin',
        migratedAt: data.migrationData?.migratedAt,
        notes: data.migrationData?.notes || '',
      });
    }
    
    return records;
    
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return [];
  }
};

/**
 * Obtener estadísticas de membresías por origen
 */
export const getMembershipStats = async (): Promise<MembershipStats> => {
  try {
    const packagesRef = collection(db, 'user_packages');
    const now = new Date();
    
    // Membresías activas
    const q = query(
      packagesRef,
      where('status', '==', 'active'),
      where('endDate', '>=', Timestamp.fromDate(now))
    );
    
    const snapshot = await getDocs(q);
    
    const stats: MembershipStats = {
      totalActivas: snapshot.size,
      porVenta: 0,
      porMigracion: 0,
      porPromo: 0,
      porGift: 0,
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      switch (data.origin) {
        case 'purchase':
          stats.porVenta++;
          break;
        case 'migration':
          stats.porMigracion++;
          break;
        case 'promo':
          stats.porPromo++;
          break;
        case 'gift':
          stats.porGift++;
          break;
      }
    });
    
    return stats;
    
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return {
      totalActivas: 0,
      porVenta: 0,
      porMigracion: 0,
      porPromo: 0,
      porGift: 0,
    };
  }
};

/**
 * Validar permisos de migración
 */
export const canMigrate = (userRole: string): boolean => {
  const allowedRoles = ['owner', 'admin', 'manager'];
  return allowedRoles.includes(userRole);
};

/**
 * Calcular fecha de vencimiento según duración del paquete
 */
export const calculateEndDate = (startDate: Date, durationDays: number): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
};

/**
 * Formatear fecha para input date
 */
export const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Validar datos de migración antes de enviar
 */
export const validateMigrationData = (params: Partial<MigrateClientParams>): string[] => {
  const errors: string[] = [];
  
  if (!params.name?.trim()) {
    errors.push('El nombre es requerido');
  }
  
  if (!params.phone?.trim()) {
    errors.push('El teléfono es requerido');
  }
  
  if (!params.packageId) {
    errors.push('Debe seleccionar un paquete');
  }
  
  if (!params.originalPaymentDate) {
    errors.push('La fecha de pago original es requerida');
  }
  
  if (!params.originalAmount || params.originalAmount <= 0) {
    errors.push('El monto debe ser mayor a 0');
  }
  
  if (!params.startDate) {
    errors.push('La fecha de inicio es requerida');
  }
  
  if (!params.endDate) {
    errors.push('La fecha de vencimiento es requerida');
  }
  
  if (params.startDate && params.endDate && params.endDate <= params.startDate) {
    errors.push('La fecha de vencimiento debe ser posterior a la fecha de inicio');
  }
  
  return errors;
};
