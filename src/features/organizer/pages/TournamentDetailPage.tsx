import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tournamentService } from '@/features/tournaments/services/tournamentService';
import { Tournament } from '@/features/tournaments/types/tournament.types';
import { canSubmitForApproval, formatDateDisplay, formatTimeDisplay, getStatusLabel } from '@/features/tournaments/utils/tournamentHelpers';
import { useAuthStore } from '@/store/authStore';

const TournamentDetailPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);

  useEffect(() => {
    const fetchTournament = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      if (!tournamentId) {
        setError('Tournament ID is required');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await tournamentService.getTournamentById(tournamentId);
        if (data) {
          // Check if the organizer owns this tournament
          if (data.organizerId !== user.id) {
            navigate('/unauthorized');
            return;
          }
          setTournament(data);
        } else {
          setError('Tournament not found');
        }
      } catch (err) {
        setError('Failed to load tournament');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [user, navigate, tournamentId]);

  if (loading) {
    return <div className="text-center py-10">Loading tournament...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600 py-10">{error}</div>;
  }

  if (!tournament) {
    return <div className="text-center py-10">No tournament data.</div>;
  }

  const { label, color } = getStatusLabel(tournament.status);
  const canSubmit = canSubmitForApproval(tournament.status);

  const handleEdit = () => {
    navigate(`/organizer/tournaments/${tournament.id}/edit`);
  };

  const handleSubmitForApproval = async () => {
    if (!canSubmit || submittingForApproval) return;
    setSubmitError(null);
    setSubmittingForApproval(true);
    try {
      const updated = await tournamentService.submitTournamentForApproval(tournament.id);
      setTournament(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit tournament for approval';
      setSubmitError(errorMessage);
      console.error('Failed to submit tournament for approval:', err);
    } finally {
      setSubmittingForApproval(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
        <p className="text-sm text-gray-500">Tournament Code: {tournament.tournamentCode}</p>
      </div>

      <div className="border rounded-lg p-6 bg-white mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-700">Status</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
              {label}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {/* Edit button - only show for draft tournaments */}
            {tournament.status === 'DRAFT' && (
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Edit
              </button>
            )}

            {canSubmit && (
              <button
                onClick={handleSubmitForApproval}
                disabled={submittingForApproval}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingForApproval ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm text-gray-700">
          <div>
            <p className="font-medium mb-1">Date</p>
            <p>{formatDateDisplay(tournament.tournamentDate)}</p>
          </div>
          <div>
            <p className="font-medium mb-1">Reporting Time</p>
            <p>{formatTimeDisplay(tournament.reportingTime)}</p>
          </div>
          <div>
            <p className="font-medium mb-1">Venue</p>
            <p>{tournament.venueName}</p>
            <p className="mt-1 text-gray-500">{tournament.venueAddress}</p>
          </div>
          <div>
            <p className="font-medium mb-1">Format</p>
            <p>
              {tournament.format === 'KNOCKOUT' && 'Knockout'}
              {tournament.format === 'LEAGUE' && 'League'}
              {tournament.format === 'LEAGUE_KNOCKOUT' && 'League + Knockout'}
            </p>
          </div>
          <div>
            <p className="font-medium mb-1">Categories</p>
            <p>{tournament.categories.length} category{tournament.categories.length !== 1 && 'ies'}</p>
          </div>
          <div>
            <p className="font-medium mb-1">Registration Close Date</p>
            <p>{formatDateDisplay(tournament.registrationCloseDate)}</p>
          </div>
          <div>
            <p className="font-medium mb-1">Registration Close Time</p>
            <p>{formatTimeDisplay(tournament.registrationCloseTime)}</p>
          </div>
        </div>

        {tournament.description && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-2">Description</h2>
            <p className="text-gray-600">{tournament.description}</p>
          </div>
        )}

        {Array.isArray(tournament.generalRules) && tournament.generalRules.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-2">General Rules</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              {tournament.generalRules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          </div>
        )}

        {tournament.categories.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-2">Categories</h2>
            <div className="space-y-4">
              {tournament.categories.map((category, index) => (
                <div key={index} className="border p-4 rounded bg-gray-50">
                  <h3 className="font-medium mb-2">{category.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium mb-1">Event Type</p>
                      <p>{category.eventType === 'SINGLES' ? 'Singles' : 'Doubles'}</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Medalists Allowed</p>
                      <p>{category.medalistsAllowed ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Open Players Allowed</p>
                      <p>{category.openPlayersAllowed ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Beginner Only</p>
                      <p>{category.beginnerOnly ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Pure Beginner Only</p>
                      <p>{category.pureBeginnerOnly ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  {category.additionalRuleNotes && (
                    <div className="mt-3">
                      <p className="font-medium mb-1">Additional Rule Notes</p>
                      <p className="text-gray-600">{category.additionalRuleNotes}</p>
                    </div>
                  )}
                  <button onClick={() => navigate(`/organizer/tournaments/${tournament.id}/categories/${category.id}`)} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">
                    View registrations & fixture shuffle →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tournament.prizes && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-2">Prizes</h2>
            <p className="text-gray-600">{tournament.prizes}</p>
          </div>
        )}

        {tournament.shuttle && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-2">Shuttle Type</h2>
            <p className="text-gray-600">{tournament.shuttle}</p>
          </div>
        )}

        {tournament.scoringFormat && (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-2">Scoring Format</h2>
            <p className="text-gray-600">{tournament.scoringFormat}</p>
          </div>
        )}

        {submitError && (
          <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700">
            {submitError}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/organizer/tournaments')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mr-2"
        >
          Back to List
        </button>
      </div>
    </div>
  );
};

export default TournamentDetailPage;
