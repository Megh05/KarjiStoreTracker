import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import OrderTimeline from "@/components/order-timeline";
import type { OrderTrackingData } from "@/pages/chatbot";

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: OrderTrackingData;
}

export default function OrderTrackingModal({ 
  isOpen, 
  onClose, 
  orderData 
}: OrderTrackingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-neutral-800">
            Order Details
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-neutral-50 rounded-lg p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-neutral-800 mb-3">Order Information</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Order Number:</strong> {orderData.order.orderNumber}</p>
                  <p><strong>Customer:</strong> {orderData.order.customer.name}</p>
                  <p><strong>Email:</strong> {orderData.order.customer.email}</p>
                  <p><strong>Order Date:</strong> {new Date(orderData.order.orderDate).toLocaleDateString()}</p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className="px-2 py-1 bg-primary text-white rounded text-xs">
                      {orderData.order.status}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-800 mb-3">Latest Update</h3>
                {orderData.latestUpdate ? (
                  <div className="space-y-2 text-sm">
                    <p><strong>Status:</strong> {orderData.latestUpdate.status}</p>
                    <p><strong>Updated:</strong> {new Date(orderData.latestUpdate.date).toLocaleString()}</p>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No updates available</p>
                )}
              </div>
            </div>
          </div>

          {/* Order Timeline */}
          <div>
            <h3 className="font-semibold text-neutral-800 mb-6">Order Progress</h3>
            <OrderTimeline timeline={orderData.timeline} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
