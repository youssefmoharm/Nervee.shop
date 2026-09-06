import { Check } from 'lucide-react';

interface CheckoutStepperProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

/**
 * Checkout progress stepper
 * Shows the user's current position in the checkout flow
 *
 * Example:
 * <CheckoutStepper
 *   currentStep={2}
 *   totalSteps={5}
 *   steps={['Information', 'Shipping', 'Delivery', 'Payment', 'Confirmation']}
 * />
 */
export default function CheckoutStepper({ currentStep, totalSteps, steps }: CheckoutStepperProps) {
  return (
    <div className="mb-8">
      {/* Desktop Stepper */}
      <div className="hidden sm:flex justify-between items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step Circle */}
              <div
                className={`
                  flex items-center justify-center
                  w-10 h-10 rounded-full font-bold text-sm
                  transition-all duration-200
                  ${
                    isCompleted
                      ? 'bg-navy text-white'
                      : isActive
                      ? 'bg-navy text-white ring-2 ring-navy ring-offset-2'
                      : 'bg-mist text-navy/50'
                  }
                `}
              >
                {isCompleted ? <Check size={18} /> : stepNumber}
              </div>

              {/* Step Label */}
              <div className="ml-3 flex-1">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide transition-colors ${
                    isActive || isCompleted ? 'text-navy' : 'text-navy/40'
                  }`}
                >
                  {step}
                </p>
              </div>

              {/* Connector Line */}
              {stepNumber < steps.length && <div className="flex-1 h-0.5 mx-3 bg-mist" />}
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper (Compact) */}
      <div className="sm:hidden">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-navy">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-xs text-navy/60">{steps[currentStep - 1]}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-mist rounded-full overflow-hidden">
          <div
            className="h-full bg-navy transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Mobile Step Indicators (dots) */}
        <div className="flex gap-2 mt-3 justify-center">
          {steps.map((_, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep;
            const isCompleted = stepNumber < currentStep;

            return (
              <div
                key={index}
                className={`
                  w-2 h-2 rounded-full transition-all
                  ${isCompleted ? 'bg-navy w-3' : isActive ? 'bg-navy' : 'bg-mist'}
                `}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
