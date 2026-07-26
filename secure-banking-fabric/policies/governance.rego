package banking.governance

default allow = false
default require_otp = false
default deny_reason = "Operation denied by governance policy"

# Allow rule
allow if {
    operation_permitted
    account_permitted
    transaction_cap_ok
    daily_cap_ok
}

# Require OTP rule (e.g. if amount > requireOtpAbove)
require_otp if {
    allow
    input.operation.amount
    input.operation.amount > input.policy.conditions.requireOtpAbove
}

operation_permitted if {
    input.operation.type == input.policy.allowedOperations[_]
}

account_permitted if {
    not is_excluded_account
}

is_excluded_account if {
    input.operation.accountType == input.policy.resourceScopes.excludedAccountTypes[_]
}

transaction_cap_ok if {
    not input.operation.amount
}

transaction_cap_ok if {
    input.operation.amount <= input.policy.limits.perTransactionCap
}

daily_cap_ok if {
    not input.operation.amount
}

daily_cap_ok if {
    input.operation.amount + input.customer.dailySpend <= input.policy.limits.dailyCap
}

# Reason evaluation for diagnostics & audit log
deny_reason = "Account type excluded from agent access" if {
    is_excluded_account
} else = "Operation type not permitted for this agent policy" if {
    not operation_permitted
} else = "Amount exceeds per-transaction cap" if {
    not transaction_cap_ok
} else = "Amount exceeds daily customer spend cap" if {
    not daily_cap_ok
} else = "Policy evaluation passed" if {
    allow
}
