import { calculatePasswordStrength, getPasswordStrengthDisplay, validatePasswordRequirements } from '../lib/passwordValidation'
import { Check, X } from 'lucide-react'

interface PasswordStrengthIndicatorProps {
  password: string
  showRequirements?: boolean
}

export default function PasswordStrengthIndicator({ 
  password, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const strength = calculatePasswordStrength(password)
  const display = getPasswordStrengthDisplay(strength.score)
  const requirements = validatePasswordRequirements(password)

  // Calculate progress bar width
  const progressWidth = (strength.score / 4) * 100

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-navy/60">Password Strength</span>
          <span className={`text-xs font-medium ${display.color}`}>
            {display.label}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              strength.score === 0 ? 'bg-red-500' :
              strength.score === 1 ? 'bg-red-400' :
              strength.score === 2 ? 'bg-yellow-400' :
              strength.score === 3 ? 'bg-blue-500' :
              'bg-green-500'
            }`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && password && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-navy/60">Password Requirements</p>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <RequirementItem 
              met={requirements.minLength}
              text="At least 8 characters"
            />
            <RequirementItem 
              met={requirements.hasLowercase}
              text="Lowercase letter (a-z)"
            />
            <RequirementItem 
              met={requirements.hasUppercase}
              text="Uppercase letter (A-Z)"
            />
            <RequirementItem 
              met={requirements.hasNumber}
              text="Number (0-9)"
            />
            <RequirementItem 
              met={requirements.hasSpecialChar}
              text="Special character (!@#$%^&*)"
            />
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {strength.feedback.length > 0 && password && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-xs font-medium text-yellow-800 mb-1">Suggestions:</p>
          <ul className="text-xs text-yellow-700 space-y-0.5">
            {strength.feedback.map((item, index) => (
              <li key={index} className="flex items-center gap-1">
                <span className="w-1 h-1 bg-yellow-600 rounded-full flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
        met ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
      }`}>
        {met ? <Check size={10} /> : <X size={10} />}
      </div>
      <span className={met ? 'text-green-700' : 'text-gray-500'}>
        {text}
      </span>
    </div>
  )
}