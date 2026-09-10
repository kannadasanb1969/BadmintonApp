import { Link } from 'react-router-dom';
import { Tournament, TournamentStatus } from '@/features/tournaments/types/tournament.types';
import { displayRegistrationCount, getStatusLabel, formatDateDisplay, formatTimeDisplay } from '@/features/tournaments/utils/tournamentHelpers';

interface TournamentListItemProps {
  tournament: Tournament;
}

const TournamentListItem = ({ tournament }: TournamentListItemProps) => {
  const { label, color } = getStatusLabel(tournament.status);
  const registeredPlayers = displayRegistrationCount(tournament.registeredPlayerCount);
  const registeredTeams = displayRegistrationCount(tournament.registeredTeamCount);
  const isDoublesOnly = tournament.categories.length > 0 && tournament.categories.every(category => category.eventType === 'DOUBLES');

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
          <p className="text-sm text-gray-600">{tournament.tournamentCode}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
          {label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 text-sm text-gray-700">
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
          <p className="font-medium mb-1">Status</p>
          <p>{label}</p>
        </div>
        <div>
          <p className="font-medium mb-1">Registrations</p>
          <div className="flex flex-wrap gap-2"><span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">👥 {registeredPlayers} Players Registered</span>{isDoublesOnly && registeredTeams > 0 && <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">🏸 {registeredTeams} Teams</span>}</div>
        </div>
      </div>

      {tournament.description && (
        <div className="mb-4">
          <p className="font-medium mb-1">Description</p>
          <p className="text-gray-600">{tournament.description}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Link
          to={`/organizer/tournaments/${tournament.id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View Details
        </Link>

        <div className="flex items-center space-x-3">
          {/* Edit button - only show for draft tournaments */}
          {tournament.status === 'DRAFT' && (
            <Link
              to={`/organizer/tournaments/${tournament.id}/edit`}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Edit
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentListItem;
