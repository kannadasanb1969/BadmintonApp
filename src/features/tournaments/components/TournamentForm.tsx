import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  TournamentFormValues,
  TournamentCategory,
  TournamentStatus,
  TournamentFormat,
  EventType,
  Tournament
} from '@/features/tournaments/types/tournament.types';
import { tournamentService } from '@/features/tournaments/services/tournamentService';
import {
  validateTournamentDates,
  validateCategories,
  validateCategoryEventTypes,
  validateTimeFormat,
  getStatusLabel
} from '@/features/tournaments/utils/tournamentHelpers';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, useParams } from 'react-router-dom';

interface TournamentFormProps {
  onSubmitSuccess?: (tournament: Tournament) => void;
  onSubmitError?: (error: unknown) => void;
  onSubmitForApprovalSuccess?: (tournament: Tournament) => void;
  onSubmitForApprovalError?: (error: unknown) => void;
}

const TournamentForm = ({
  onSubmitSuccess,
  onSubmitError,
  onSubmitForApprovalSuccess,
  onSubmitForApprovalError
}: TournamentFormProps = {}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const isEditMode = !!tournamentId;

  const [initialCategories, setInitialCategories] = useState<TournamentCategory[]>([
    {
      id: '', // Will be removed in form values
      name: '',
      eventType: 'SINGLES' as EventType,
      medalistsAllowed: false,
      openPlayersAllowed: false,
      beginnerOnly: false,
      pureBeginnerOnly: false,
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitForApprovalError, setSubmitForApprovalError] = useState<string | null>(null);
  const [customRules, setCustomRules] = useState<{ id: number; text: string; enabled: boolean }[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    getValues,
    setError: setFormError,
    clearErrors
  } = useForm<TournamentFormValues>({
    defaultValues: {
      name: '',
      description: '',
      tournamentDate: '',
      reportingTime: '',
      registrationCloseDate: '',
      registrationCloseTime: '',
      venueName: '',
      venueAddress: '',
      mapLink: '',
      format: 'KNOCKOUT' as TournamentFormat,
      categories: initialCategories,
      generalRules: [],
    },
    mode: 'onBlur',
  });

  // Fetch tournament data if editing
  useEffect(() => {
    if (isEditMode && tournamentId) {
      const fetchTournament = async () => {
        try {
          setLoading(true);
          const data = await tournamentService.getTournamentById(tournamentId);
          if (data) {
            // Check if the organizer owns this tournament
            if (data.organizerId !== user.id) {
              navigate('/unauthorized');
              return;
            }
            // Check if the tournament is DRAFT for editing
            if (data.status !== 'DRAFT') {
              // If we are trying to edit a non-DRAFT tournament, redirect to detail page
              navigate(`/organizer/tournaments/${data.id}`);
              return;
            }
            // Convert tournament to form values
            const formValues = {
              name: data.name,
              description: data.description,
              tournamentDate: data.tournamentDate,
              reportingTime: data.reportingTime,
              registrationCloseDate: data.registrationCloseDate,
              registrationCloseTime: data.registrationCloseTime,
              venueName: data.venueName,
              venueAddress: data.venueAddress,
              mapLink: data.mapLink || '',
              format: data.format,
              categories: data.categories.map((cat) => ({
                name: cat.name,
                eventType: cat.eventType,
                minAge: cat.minAge,
                maxAge: cat.maxAge,
                maxTeams: cat.maxTeams,
                medalistsAllowed: cat.medalistsAllowed,
                openPlayersAllowed: cat.openPlayersAllowed,
                beginnerOnly: cat.beginnerOnly,
                pureBeginnerOnly: cat.pureBeginnerOnly,
                additionalRuleNotes: cat.additionalRuleNotes || undefined,
              })),
              generalRules: data.generalRules,
            };
            reset(formValues);
          } else {
            // Tournament not found
            navigate('/organizer/tournaments');
            return;
          }
        } catch (err) {
          console.error('Failed to fetch tournament:', err);
          navigate('/organizer/tournaments');
          return;
        } finally {
          setLoading(false);
        }
      };
      fetchTournament();
    }
  }, [isEditMode, tournamentId, navigate, reset]);

  // Watch for category changes to validate (optional, for live validation if desired)
  const categories = watch('categories');

  const updateCustomRule = (id: number, changes: Partial<{ text: string; enabled: boolean }>) => {
    const updatedRules = customRules.map(rule => rule.id === id ? { ...rule, ...changes } : rule);
    setCustomRules(updatedRules);
    setValue('categories.0.additionalRuleNotes', updatedRules.filter(rule => rule.enabled && rule.text.trim()).map(rule => rule.text.trim()).join('\n'));
  };

  useEffect(() => {
    if (categories.length > 0) {
      const categoriesValidation = validateCategories(categories);
      if (!categoriesValidation.isValid) {
        // We could set a form error here, but for simplicity we'll just log
        console.warn('Categories validation failed:', categoriesValidation.error);
      }

      const eventTypesValidation = validateCategoryEventTypes(categories);
      if (!eventTypesValidation.isValid) {
        console.warn('Category event types validation failed:', eventTypesValidation.error);
      }
    }
  }, [categories]);

  const validateForSubmission = (data: TournamentFormValues): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};

    // Validate required fields
    if (!data.name) {
      fieldErrors.name = 'Tournament name is required';
    }
    if (!data.tournamentDate) {
      fieldErrors.tournamentDate = 'Tournament date is required';
    }
    if (!data.reportingTime) {
      fieldErrors.reportingTime = 'Reporting time is required';
    }
    if (!data.registrationCloseDate) {
      fieldErrors.registrationCloseDate = 'Registration close date is required';
    }
    if (!data.registrationCloseTime) {
      fieldErrors.registrationCloseTime = 'Registration close time is required';
    }
    if (!data.venueName) {
      fieldErrors.venueName = 'Venue name is required';
    }
    if (!data.venueAddress) {
      fieldErrors.venueAddress = 'Venue address is required';
    }
    if (!data.format) {
      fieldErrors.format = 'Format is required';
    }
    if (!data.categories || data.categories.length === 0) {
      fieldErrors.categories = 'At least one category is required';
    } else {
      // Validate each category
      data.categories.forEach((category, index) => {
        if (!category.name) {
          fieldErrors[`categories.${index}.name`] = 'Category name is required';
        }
        if (!category.eventType) {
          fieldErrors[`categories.${index}.eventType`] = 'Event Type is required';
        }
        const validEventTypes = ['SINGLES', 'DOUBLES'];
        if (!validEventTypes.includes(category.eventType)) {
          fieldErrors[`categories.${index}.eventType`] = `Invalid event type. Must be 'SINGLES' or 'DOUBLES'`;
        }
        // Validate minAge and maxAge
        if (category.minAge !== undefined && category.maxAge !== undefined) {
          if (category.minAge > category.maxAge) {
            fieldErrors[`categories.${index}.minAge`] = 'Min age must be less than or equal to max age';
            fieldErrors[`categories.${index}.maxAge`] = 'Max age must be greater than or equal to min age';
          }
        }
        // Validate maxTeams
        if (category.maxTeams !== undefined && category.maxTeams <= 0) {
          fieldErrors[`categories.${index}.maxTeams`] = 'Max teams must be positive';
        }
      });
    }

    // Validate dates
    if (data.tournamentDate && data.registrationCloseDate) {
      const dateValidation = validateTournamentDates(data.tournamentDate, data.registrationCloseDate);
      if (!dateValidation.isValid) {
        fieldErrors.registrationCloseDate = dateValidation.error;
      }
    }

    // Validate times
    const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (data.reportingTime && !timeFormat.test(data.reportingTime)) {
      fieldErrors.reportingTime = 'Please enter a valid time in HH:mm format';
    }
    if (data.registrationCloseTime && !timeFormat.test(data.registrationCloseTime)) {
      fieldErrors.registrationCloseTime = 'Please enter a valid time in HH:mm format';
    }

    return fieldErrors;
  };

  const onSaveDraft = async (data: TournamentFormValues) => {
    setSubmitError(null);
    setSubmitForApprovalError(null);
    try {
      setLoading(true);
      const normalizedData = {
        ...data,
        generalRules: (Array.isArray(data.generalRules) ? data.generalRules : String(data.generalRules ?? '').split('\n')).map(rule => String(rule).trim()).filter(Boolean),
      } as TournamentFormValues;

      let result;
      if (isEditMode && tournamentId) {
        result = await tournamentService.updateTournament(tournamentId, normalizedData);
      } else {
        if (!user) {
          throw new Error('User not authenticated');
        }
        result = await tournamentService.createTournament(normalizedData, user);
      }

      if (onSubmitSuccess) {
        onSubmitSuccess(result);
      }

      // Reset form after successful submission
      reset({
        name: '',
        description: '',
        tournamentDate: '',
        reportingTime: '',
        registrationCloseDate: '',
        registrationCloseTime: '',
        venueName: '',
        venueAddress: '',
        mapLink: '',
        format: 'KNOCKOUT' as TournamentFormat,
        categories: [
          {
            id: '',
            name: '',
            eventType: 'SINGLES' as EventType,
            medalistsAllowed: false,
            openPlayersAllowed: false,
            beginnerOnly: false,
            pureBeginnerOnly: false,
          }
        ],
        generalRules: [],
      });

      // Navigate to dashboard or tournament list on success
      navigate('/organizer/dashboard');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setSubmitError(errorMessage);
      if (onSubmitError) {
        onSubmitError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitForApproval = async () => {
    setSubmitError(null);
    setSubmitForApprovalError(null);
    try {
      setLoading(true);

      const data = getValues();
      const fieldErrors = validateForSubmission(data);

      // If there are field errors, set them in the form
      if (Object.keys(fieldErrors).length > 0) {
        Object.entries(fieldErrors).forEach(([field, message]) => {
          setFormError(field as keyof TournamentFormValues, { type: 'manualSubmit', message });
        });
        throw new Error('Please fix the errors in the form');
      }

      // Clear any existing form errors
      clearErrors();

      // Submit for approval
      await tournamentService.submitTournamentForApproval(tournamentId);

      // Refetch the tournament to update status
      const updated = await tournamentService.getTournamentById(tournamentId);
      if (updated) {
        if (onSubmitForApprovalSuccess) {
          onSubmitForApprovalSuccess(updated);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit tournament for approval';
      setSubmitForApprovalError(errorMessage);
      if (onSubmitForApprovalError) {
        onSubmitForApprovalError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tournament-form space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
        <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full border-[18px] border-emerald-300/15" />
        <div className="relative"><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">Organizer workspace</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{isEditMode ? 'Fine-tune your tournament' : 'Build your next badminton event'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Set the court, schedule, categories, and rules. Save your draft anytime before sending it for approval.</p></div>
        <div className="relative mt-6 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white/10 px-3 py-1.5">1 · Event details</span><span className="rounded-full bg-white/10 px-3 py-1.5">2 · Categories</span><span className="rounded-full bg-white/10 px-3 py-1.5">3 · Rules & submit</span></div>
      </section>
      <form onSubmit={handleSubmit(onSaveDraft)} className="space-y-6">
        {/* Tournament Basic Info */}
        <section className="form-panel space-y-4">
          <div className="form-panel-heading"><span>01</span><div><h3>Event details</h3><p>Give players the information they need before joining.</p></div></div>
          <div>
            <label className="block text-sm font-medium mb-2">Tournament Name</label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter tournament name"
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter tournament description"
            />
          </div>
        </section>

        {/* Dates and Times */}
        <section className="form-panel"><div className="form-panel-heading"><span>02</span><div><h3>Schedule</h3><p>Choose the tournament day and registration cutoff.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tournament Date</label>
            <input
              {...register('tournamentDate')}
              type="date"
              className="tournament-date-picker w-full px-4 py-3 border rounded-xl"
            />
            {errors.tournamentDate && <p className="text-sm text-red-600">{errors.tournamentDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reporting Time</label>
            <input
              {...register('reportingTime')}
              type="time"
              className="tournament-date-picker w-full px-4 py-3 border rounded-xl"
            />
            {errors.reportingTime && <p className="text-sm text-red-600">{errors.reportingTime.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Registration Close Date</label>
            <input
              {...register('registrationCloseDate')}
              type="date"
              className="tournament-date-picker w-full px-4 py-3 border rounded-xl"
            />
            {errors.registrationCloseDate && <p className="text-sm text-red-600">{errors.registrationCloseDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Registration Close Time</label>
            <input
              {...register('registrationCloseTime')}
              type="time"
              className="tournament-date-picker w-full px-4 py-3 border rounded-xl"
            />
            {errors.registrationCloseTime && <p className="text-sm text-red-600">{errors.registrationCloseTime.message}</p>}
          </div>
        </div></section>

        {/* Venue Info */}
        <section className="form-panel space-y-4"><div className="form-panel-heading"><span>03</span><div><h3>Court & format</h3><p>Tell players where and how the event will run.</p></div></div>
          <div>
            <label className="block text-sm font-medium mb-2">Venue Name</label>
            <input
              {...register('venueName')}
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter venue name"
            />
            {errors.venueName && <p className="text-sm text-red-600">{errors.venueName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Venue Address</label>
            <input
              {...register('venueAddress')}
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter venue address"
            />
            {errors.venueAddress && <p className="text-sm text-red-600">{errors.venueAddress.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Map Link (Optional)</label>
            <input
              {...register('mapLink')}
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter Google Maps link or other URL"
            />
          </div>
        </section>

        {/* Tournament Format */}
        <section className="form-panel space-y-4">
          <div className="form-panel-heading"><span>04</span><div><h3>Match format</h3><p>Choose the draw format and event type.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium">Format</label>
            <select
              {...register('format')}
              className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="KNOCKOUT">Knockout</option>
              <option value="LEAGUE">League</option>
              <option value="LEAGUE_KNOCKOUT">League + Knockout</option>
            </select>
            </div>
            <div><label className="mb-2 block text-sm font-medium">Event Type</label><select {...register('categories.0.eventType')} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="SINGLES">Singles</option><option value="DOUBLES">Doubles</option></select></div>
            <div><label className="mb-2 block text-sm font-medium">Player eligibility</label><select {...register('categories.0.genderEligibility')} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="OPEN">Open to all</option><option value="WOMEN_ONLY">Women only</option><option value="MEN_ONLY">Men only</option></select></div>
          </div>
        </section>

        {/* Categories */}
        <section className="form-panel space-y-4">
          <div className="form-panel-heading"><span>05</span><div><h3>Eligibility rules</h3><p>Choose which players can join this event.</p></div></div>
          <div id="categories-container" className="space-y-3">
            {categories.map((category, index) => (
              <div key={index} className="border rounded p-4 bg-gray-50">
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`category-name-${index}`} className="mb-2 block text-sm font-medium">
                      Category Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id={`category-name-${index}`}
                      {...register(`categories.${index}.name`, {
                        required: 'Category name is required',
                      })}
                      type="text"
                      className="w-full rounded border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={category.eventType === 'DOUBLES' ? "e.g., Men's Doubles" : "e.g., Men's Singles"}
                    />
                    {errors.categories?.[index]?.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.categories[index]?.name?.message}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      {...register(`categories.${index}.medalistsAllowed`)}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600"
                    />
                    <label className="text-sm font-medium">Medalists Allowed</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      {...register(`categories.${index}.openPlayersAllowed`)}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600"
                    />
                    <label className="text-sm font-medium">Open Players Allowed</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      {...register(`categories.${index}.beginnerOnly`)}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600"
                    />
                    <label className="text-sm font-medium">Beginner Only</label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      {...register(`categories.${index}.pureBeginnerOnly`)}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600"
                    />
                    <label className="text-sm font-medium">Pure Beginner Only</label>
                  </div>
                </div>

                {index === 0 && customRules.length > 0 && <div className="mt-5 space-y-2 border-t border-slate-200 pt-4"><p className="text-sm font-bold text-slate-700">Custom rules</p>{customRules.map(rule => <div key={rule.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"><label className="flex shrink-0 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={rule.enabled} onChange={event => updateCustomRule(rule.id, { enabled: event.target.checked })} />Apply rule</label><input value={rule.text} onChange={event => updateCustomRule(rule.id, { text: event.target.value })} placeholder="Example: Players must report 30 minutes early" className="w-full px-3 py-2 border rounded-lg" /><button type="button" onClick={() => { const updatedRules = customRules.filter(item => item.id !== rule.id); setCustomRules(updatedRules); setValue('categories.0.additionalRuleNotes', updatedRules.filter(item => item.enabled && item.text.trim()).map(item => item.text.trim()).join('\n')); }} className="text-sm font-semibold text-red-600 hover:text-red-800">Remove</button></div>)}</div>}
              </div>
            ))}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCustomRules(rules => [...rules, { id: Date.now(), text: '', enabled: true }])}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                + Add custom rule
              </button>
            </div>
          </div>
        </section>

        {/* Notes, prizes, and scoring */}
        <section className="form-panel space-y-4">
          <div className="form-panel-heading"><span>06</span><div><h3>Event notes & scoring</h3><p>Add prizes, shuttle details, scoring, and any notes for players.</p></div></div>
        {/* Prizes and Shuttle Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Prizes (Optional)</label>
            <input
              {...register('prizes')}
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe prizes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Shuttle Type (Optional)</label>
            <input
              {...register('shuttle')}
              type="text"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Yonex Aerosena"
            />
          </div>
        </div>

        {/* Scoring Format */}
        <div className="space-y-4">
          <label className="block text-sm font-medium mb-2">Scoring Format (Optional)</label>
          <input
            {...register('scoringFormat')}
            type="text"
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 21 points, best of 3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
          <textarea
            {...register('generalRules')}
            rows={4}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add any instructions or notes for players"
          />
          <p className="mt-2 text-sm text-gray-500">Write each note on a new line.</p>
        </div>

        {/* Submit Buttons */}
        </section>
        <div className="sticky bottom-4 flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className={`w-auto px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
          >
            {isSubmitting || loading ? 'Saving...' : isEditMode ? 'Update Tournament' : 'Create Tournament'}
          </button>

          <button
            type="button"
            onClick={onSubmitForApproval}
            disabled={isSubmitting || loading}
            className={`w-auto px-6 py-3 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
          >
            {isSubmitting || loading ? 'Submitting...' : 'Submit for Approval'}
          </button>

          {submitError && (
            <p className="mt-2 text-sm text-red-600 w-full text-center">
              {submitError}
            </p>
          )}

          {submitForApprovalError && (
            <p className="mt-2 text-sm text-red-600 w-full text-center">
              {submitForApprovalError}
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default TournamentForm;
