import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import PlayerProfileForm from '@/features/player/components/PlayerProfileForm'
import { PlayerProfile } from '@/features/player/types/player.types'
import { MedalHistory } from '@/features/medals/types/medalHistory.types'
import { medalHistoryService } from '@/features/medals/services/medalHistoryService'
import { useState, useEffect } from 'react'

const PlayerProfilePage = () => {
  const { profile, hasProfile } = usePlayerProfileStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditRoute = location.pathname === '/player/profile/edit'
  const [medalHistory, setMedalHistory] = useState<MedalHistory[]>([])
  const [medalHistoryLoading, setMedalHistoryLoading] = useState<boolean>(false)
  const [medalHistoryError, setMedalHistoryError] = useState<string | null>(null)

  // Load medal history when profile loads
  useEffect(() => {
    if (hasProfile && profile) {
      const loadMedalHistory = async () => {
        setMedalHistoryLoading(true)
        setMedalHistoryError(null)
        try {
          const playerMedals = await medalHistoryService.getPlayerMedals(profile.id)
          setMedalHistory(playerMedals)
        } catch (err) {
          setMedalHistoryError(err instanceof Error ? err.message : 'Failed to load medal history')
        } finally {
          setMedalHistoryLoading(false)
        }
      }

      loadMedalHistory()
    }
  }, [hasProfile, profile])

  // If there's no profile and we're on the edit route, redirect to the profile page
  if (!hasProfile && isEditRoute) {
    return <Navigate to="/player/profile" replace />
  }

  const handleProfileCreated = () => {
    // After creating or updating a profile, if we were on the edit route, go back to view
    if (isEditRoute) {
      navigate('/player/profile', { replace: true })
    }
  }

  if (!hasProfile) {
    // No profile, show the create form
    return <PlayerProfileForm onProfileCreated={handleProfileCreated} />
  }

  // We have a profile
  if (isEditRoute) {
    // Show the edit form with the existing profile
    return <PlayerProfileForm profile={profile} onProfileCreated={handleProfileCreated} />
  }

  // Show the profile view
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Header Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl sm:p-8 mb-8">
            <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[24px] border-emerald-300/10" />
            <p className="relative mb-5 text-xs font-bold uppercase tracking-[.22em] text-emerald-300">🏸 Player card</p><div className="relative grid grid-cols-1 lg:grid-cols-2 lg:items-start lg:gap-8">
              {/* Avatar and Info */}

              <div className="flex flex-col items-center lg:items-start lg:mb-0 lg:space-y-4">
                {profile.profilePhoto ? (
                  <img
                    src={profile.profilePhoto}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-emerald-300 shadow-xl"
                  />
                ) : (
                  <div className="w-24 h-24 bg-emerald-300 rounded-full flex items-center justify-center shadow-xl">
                    <span className="text-emerald-950 font-black text-lg">
                      {profile.fullName
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="text-center lg:text-left space-y-3">
                  <h2 className="text-3xl font-black text-white">
                    {profile.fullName}
                  </h2>
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/10 text-emerald-200 text-sm font-bold px-3 py-1 rounded-full">
                      {profile.playerCode}
                    </div>
                    <span className={
                      `px-2 py-1 rounded-full text-sm font-medium
                      ${profile.profileStatus === 'ACTIVE'
                        ? 'bg-emerald-300 text-emerald-950'
                        : 'bg-white/10 text-slate-300'}
                    `}
                    >
                      {profile.profileStatus === 'ACTIVE' ? 'Active' : 'Incomplete'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300">📍 {profile.location} · {profile.experienceYears} years on court</div>
                </div>
              </div>

              {/* Edit Profile Button */}
              <div className="lg:col-span-2 lg:flex lg:justify-end lg:items-center lg:mt-0">
                <button
                  onClick={() => navigate('/player/profile/edit')}
                  className="px-6 py-3 bg-emerald-400 text-slate-950 rounded-xl font-bold hover:bg-white transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {/* Age */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center">
                <p className="text-xl font-black text-slate-900">
                  {profile.age}
                </p>
                <p className="text-sm text-gray-500 uppercase tracking-wider">
                  Age
                </p>
              </div>
              {/* Experience */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center">
                <p className="text-xl font-black text-slate-900">
                  {profile.experienceYears}
                </p>
                <p className="text-sm text-gray-500 uppercase tracking-wider">
                  Experience
                </p>
              </div>
              {/* Playing Since */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center">
                <p className="text-xl font-black text-slate-900">
                  {profile.playingSince}
                </p>
                <p className="text-sm text-gray-500 uppercase tracking-wider">
                  Playing Since
                </p>
              </div>
              {/* Regular Player */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 text-center">
                <p className="text-xl font-black text-slate-900">
                  {profile.regularPlayer ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-gray-500 uppercase tracking-wider">
                  Player Type
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information Card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Player details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-medium text-gray-500">
                  Mobile
                </p>
                <p className="text-lg font-medium text-gray-900">
                  {profile.mobile}
                </p>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-medium text-gray-500">
                  Location
                </p>
                <p className="text-lg font-medium text-gray-900">
                  {profile.location}
                </p>
              </div>
              {profile.regularPlayer ? (
                <>
                  <div className="grid gap-2">
                    <p className="text-sm font-medium text-gray-500">
                      Court/Academy
                    </p>
                    <p className="text-lg font-medium text-gray-900">
                      {profile.courtAcademy}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-sm font-medium text-gray-500">
                      Profile Status
                    </p>
                    <p className="text-lg font-medium text-gray-900">
                      {profile.profileStatus}
                    </p>
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm font-medium text-gray-500">
                    Profile Status
                  </p>
                  <p className="text-lg font-medium text-gray-900">
                    {profile.profileStatus}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Medal History Section */}
          {hasProfile && profile && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 mt-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                🏆 Achievements & medals
              </h2>

              {medalHistoryLoading && (
                <div className="text-center py-8">
                  Loading medal history...
                </div>
              )}

              {medalHistoryError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded">
                  Error loading medal history: {medalHistoryError}
                </div>
              )}

              {!medalHistoryLoading && !medalHistoryError && medalHistory.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No medal history yet. Participate in tournaments to earn medals!
                </div>
              )}

              {!medalHistoryLoading && !medalHistoryError && medalHistory.length > 0 && (
                <div className="space-y-4">
                  {medalHistory.map(medal => (
                    <div key={medal.id} className="border p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 flex-shrink-0">
                          {medal.medalType === 'GOLD' ? (
                            <div className="w-full h-full bg-yellow-300 rounded-full flex items-center justify-center">
                              <span className="text-yellow-800 text-sm font-bold">🥇</span>
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-gray-800 text-sm font-bold">🥈</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between">
                            <h3 className="text-lg font-medium text-gray-900">
                              {medal.tournamentName}
                            </h3>
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                              {medal.categoryName}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {medal.eventType} • {medal.position === 'WINNER' ? 'Champion' : 'Runner-Up'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Achieved: {new Date(medal.achievedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlayerProfilePage
