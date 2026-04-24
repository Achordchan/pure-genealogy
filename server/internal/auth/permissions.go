package auth

import "zupu/server/internal/model"

func IsApproved(profile model.AccountProfile) bool { return profile.Status == "approved" }
func IsAdmin(profile model.AccountProfile) bool    { return profile.Role == "admin" }
func IsEditor(profile model.AccountProfile) bool   { return profile.Role == "editor" }

func CanManageAccounts(profile model.AccountProfile) bool {
	return IsApproved(profile) && IsAdmin(profile)
}

func CanManageFamilyMembers(profile model.AccountProfile) bool {
	return IsApproved(profile) && (IsAdmin(profile) || IsEditor(profile))
}

func CanDeleteFamilyMembers(profile model.AccountProfile) bool {
	return IsApproved(profile) && IsAdmin(profile)
}

func CanReviewMemberChanges(profile model.AccountProfile) bool {
	return IsApproved(profile) && (IsAdmin(profile) || IsEditor(profile))
}

func CanSubmitOwnDraft(profile model.AccountProfile) bool {
	return IsApproved(profile) && profile.Role == "member" && profile.MemberID != nil
}
