import { useState } from 'react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, ClipboardCheck, Clock, Receipt } from 'lucide-react';
import { OrdersVerificationContent } from '@/pages/admin/orders/OrdersVerification';
import { TransactionsContent, PendingPaymentsContent } from '@/pages/admin/payments/PaymentsTransactions';
import { CashAssignmentContent } from '@/pages/admin/payments/CashAssignment';

export default function PaymentsHub() {
  const [tab, setTab] = useState('verification');

  return (
    <AuthGuard requiredRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Pagos</h1>
            <p className="text-muted-foreground">
              Gestiona verificaciones, transacciones y registros de pago
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="verification" className="gap-1.5">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Verificar órdenes</span>
                <span className="sm:hidden">Verificar</span>
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1.5">
                <CreditCard className="h-4 w-4" />
                <span>Transacciones</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Pendientes</span>
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Registrar Pago</span>
                <span className="sm:hidden">Registrar</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="verification">
              <OrdersVerificationContent />
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionsContent />
            </TabsContent>

            <TabsContent value="pending">
              <PendingPaymentsContent />
            </TabsContent>

            <TabsContent value="register">
              <CashAssignmentContent />
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
