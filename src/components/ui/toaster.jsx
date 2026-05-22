import { useToast } from "../../hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../ui/toast";

function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider
      swipeDirection="right"
      duration={4000}
    >
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === "destructive";
        return (
          <Toast
            key={id}
            {...props}
            className={`
              shadow-xl border rounded-lg p-4
              data-[state=open]:animate-in
              data-[state=closed]:animate-out
              data-[state=closed]:fade-out-80
              data-[state=open]:fade-in-80
              ${isDestructive ? "border-red-200 bg-red-50 text-red-950" : "border-[#DBEAFE] bg-white text-gray-900"}
            `}
          >
            <div className="grid gap-1">
              {title && (
                <ToastTitle className={`font-semibold ${isDestructive ? "text-red-950" : "text-gray-900"}`}>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className={`text-sm ${isDestructive ? "text-red-800" : "text-gray-700"}`}>
                  {description}
                </ToastDescription>
              )}
            </div>

            {action}
            <ToastClose />
          </Toast>
        );
      })}

      <ToastViewport
        className="
          fixed bottom-6 right-6 
          flex flex-col gap-3 
          z-[99999] 
          outline-none
        "
      />
    </ToastProvider>
  );
}

export { Toaster };
