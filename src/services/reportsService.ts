/**
 * 📊 SERVICIO: Reportes Financieros
 * 
 * Maneja reportes de ventas y estadísticas, EXCLUYENDO migraciones
 * para mantener datos financieros precisos.
 */

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getMembershipStats } from './migrationService';
import type { MembershipStats } from '@/types/migration.types';

export interface SalesReport {
  totalIngresos: number;
  totalTransacciones: number;
  desglose: {
    membresias: number;
    paquetes: number;
    clasesIndividuales: number;
    productos: number;
  };
  transacciones: Transaction[];
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  items: OrderItem[];
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: Date;
}

export interface OrderItem {
  packageId: string;
  packageName: string;
  packageType: string;
  quantity: number;
  price: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DashboardStats {
  // Ventas reales (excluye migraciones)
  ventasDelMes: number;
  ventasDelDia: number;
  transaccionesTotales: number;
  
  // Membresías activas (incluye todas por origen)
  membresiasActivas: MembershipStats;
  
  // Próximos vencimientos
  vencenEsteMes: number;
  vencenProximoMes: number;
}

/**
 * Obtener reporte de ventas REALES
 * Excluye migraciones automáticamente porque solo cuenta orders
 */
export const getSalesReport = async (dateRange: DateRange): Promise<SalesReport> => {
  try {
    // Solo órdenes pagadas (las migraciones NO tienen orders)
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('status', '==', 'paid'),
      where('createdAt', '>=', Timestamp.fromDate(dateRange.start)),
      where('createdAt', '<=', Timestamp.fromDate(dateRange.end)),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    const report: SalesReport = {
      totalIngresos: 0,
      totalTransacciones: snapshot.size,
      desglose: {
        membresias: 0,
        paquetes: 0,
        clasesIndividuales: 0,
        productos: 0,
      },
      transacciones: [],
    };
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      
      report.totalIngresos += data.total || 0;
      
      // Desglose por tipo
      data.items?.forEach((item: OrderItem) => {
        switch (item.packageType) {
          case 'membership':
            report.desglose.membresias += item.price * item.quantity;
            break;
          case 'package':
            report.desglose.paquetes += item.price * item.quantity;
            break;
          case 'single':
            report.desglose.clasesIndividuales += item.price * item.quantity;
            break;
          case 'product':
            report.desglose.productos += item.price * item.quantity;
            break;
        }
      });
      
      // Transacción completa
      report.transacciones.push({
        id: docSnap.id,
        userId: data.userId,
        userName: data.userName || 'Cliente',
        items: data.items || [],
        total: data.total || 0,
        status: data.status,
        paymentMethod: data.paymentMethod || 'N/A',
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    }
    
    return report;
    
  } catch (error) {
    console.error('Error al obtener reporte de ventas:', error);
    return {
      totalIngresos: 0,
      totalTransacciones: 0,
      desglose: {
        membresias: 0,
        paquetes: 0,
        clasesIndividuales: 0,
        productos: 0,
      },
      transacciones: [],
    };
  }
};

/**
 * Obtener estadísticas del dashboard
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    
    // Ventas del mes (solo orders reales)
    const ventasMesReport = await getSalesReport({
      start: startOfMonth,
      end: now,
    });
    
    // Ventas del día
    const ventasDiaReport = await getSalesReport({
      start: startOfDay,
      end: now,
    });
    
    // Membresías activas por origen
    const membresiasStats = await getMembershipStats();
    
    // Próximos vencimientos
    const packagesRef = collection(db, 'user_packages');
    
    // Vencen este mes
    const qEsteMes = query(
      packagesRef,
      where('status', '==', 'active'),
      where('endDate', '>=', Timestamp.fromDate(now)),
      where('endDate', '<=', Timestamp.fromDate(endOfMonth))
    );
    const vencenEsteMes = (await getDocs(qEsteMes)).size;
    
    // Vencen próximo mes
    const qProximoMes = query(
      packagesRef,
      where('status', '==', 'active'),
      where('endDate', '>=', Timestamp.fromDate(endOfMonth)),
      where('endDate', '<=', Timestamp.fromDate(endOfNextMonth))
    );
    const vencenProximoMes = (await getDocs(qProximoMes)).size;
    
    return {
      ventasDelMes: ventasMesReport.totalIngresos,
      ventasDelDia: ventasDiaReport.totalIngresos,
      transaccionesTotales: ventasMesReport.totalTransacciones,
      membresiasActivas: membresiasStats,
      vencenEsteMes,
      vencenProximoMes,
    };
    
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    return {
      ventasDelMes: 0,
      ventasDelDia: 0,
      transaccionesTotales: 0,
      membresiasActivas: {
        totalActivas: 0,
        porVenta: 0,
        porMigracion: 0,
        porPromo: 0,
        porGift: 0,
      },
      vencenEsteMes: 0,
      vencenProximoMes: 0,
    };
  }
};

/**
 * Formatear moneda
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

/**
 * Calcular porcentaje
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};
