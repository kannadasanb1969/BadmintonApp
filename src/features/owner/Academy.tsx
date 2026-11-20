import { useRef, useState } from 'react'
import { ApiError } from '@/api/apiClient'
import { ownerWrite, segment, uploadVenuePhoto, useOwnerQuery, type Academy, type Album, type Court, type Photo } from './api'
import { ActionForm, field, optional, Panel, QueryState, readable, rupees, TextField } from './ui'

const academyPayload = (data: FormData, current?: Academy) => ({
  name: field(data, 'name'),
  ...Object.fromEntries(['mobile', 'address', 'area', 'city', 'state', 'pincode', 'mapLink'].map(key => [key, current ? field(data, key) || null : optional(data, key)])),
})

function AcademyFields({ academy }: { academy?: Academy }) {
  return <div className="owner-fields">
    <TextField name="name" label="Academy name" required initial={academy?.name} />
    <TextField name="mobile" label="Contact mobile" type="tel" initial={academy?.mobile} />
    <TextField name="address" label="Address" initial={academy?.address} />
    <TextField name="area" label="Area" initial={academy?.area} />
    <TextField name="city" label="City" initial={academy?.city} />
    <TextField name="state" label="State" initial={academy?.state} />
    <TextField name="pincode" label="PIN code" initial={academy?.pincode} maxLength={6} />
    <TextField name="mapLink" label="Google Maps link" type="url" initial={academy?.mapLink} />
  </div>
}
const pickFiles = (data: FormData) => data.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0)

function usePhotoUploads() {
  const uploads = useRef(new Map<File, { id: string; photo?: Photo }>())
  return async (file: File) => {
    if (file.size > 10 * 1024 * 1024) throw new Error('Each venue photo must be 10 MB or smaller.')
    const entry = uploads.current.get(file) ?? { id: crypto.randomUUID() }
    uploads.current.set(file, entry)
    entry.photo ??= await uploadVenuePhoto(file, entry.id)
    return entry.photo
  }
}

export function AcademyForm({ academy }: { academy?: Academy }) {
  const upload = usePhotoUploads()
  const [prepared, setPrepared] = useState<Record<string, unknown> | null>(null)
  return <Panel title={academy ? 'Academy profile' : 'Set up your academy'}>
    <ActionForm key={academy?.id ?? 'new'} label={academy ? 'Save profile' : prepared ? 'Retry academy creation' : 'Create academy'} perform={async data => {
      const payload = academyPayload(data, academy)
      if (academy) return ownerWrite('/academies/' + segment(academy.id), payload, 'PATCH')
      let request = prepared
      if (!request) {
        const files = pickFiles(data)
        if (files.length < 1 || files.length > 5) throw new Error('Choose between one and five venue photos.')
        const photos = await Promise.all(files.map(upload))
        request = { ...payload, photoIds: photos.map(photo => photo.id), coverPhotoId: photos[0].id, registrationId: crypto.randomUUID() }
        setPrepared(request)
      }
      try { return await ownerWrite('/academies', request) }
      catch (error) {
        if (error instanceof ApiError && error.status && error.status < 500) setPrepared(null)
        throw error
      }
    }}>
      <fieldset disabled={Boolean(prepared)}>
        <AcademyFields academy={academy} />
        {!academy && <label>Venue photos (1–5)<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required /></label>}
      </fieldset>
      {prepared && <p>Retry to recover the academy creation request.</p>}
    </ActionForm>
  </Panel>
}

function GalleryEdit({ album, path }: { album: Album; path: string }) {
  const upload = usePhotoUploads()
  const [photos, setPhotos] = useState(album.photos)
  const [cover, setCover] = useState(album.photos.find(photo => photo.isCover)?.id ?? album.photos[0]?.id)
  const persist = async (data: FormData) => {
    const files = pickFiles(data)
    if (photos.length + files.length > 5) throw new Error('An album supports at most five photos.')
    const next = [...photos, ...await Promise.all(files.map(upload))]
    const coverId = next.some(item => item.id === cover) ? cover : next[0]?.id
    const saved = await ownerWrite<Album>(path, { version: album.version, photoIds: next.map(photo => photo.id), coverPhotoId: coverId ?? null }, 'PUT')
    setPhotos(saved.photos)
    setCover(saved.photos.find(photo => photo.isCover)?.id)
  }
  return <ActionForm label="Save gallery" perform={persist} reset>
    <div className="owner-gallery">{photos.map(photo => <div key={photo.id}>
      <img src={photo.url} alt="Venue" loading="lazy" />
      <label><input type="radio" name="cover" checked={cover === photo.id} onChange={() => setCover(photo.id)} /> Cover</label>
      <button type="button" className="owner-secondary" onClick={() => setPhotos(items => items.filter(item => item.id !== photo.id))}>Remove</button>
    </div>)}</div>
    <label>Add photos<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple /></label>
  </ActionForm>
}

function Gallery({ academyId, courtId }: { academyId: string; courtId?: string }) {
  const path = '/academies/' + segment(academyId) + (courtId ? '/courts/' + segment(courtId) : '') + '/photos'
  const album = useOwnerQuery<Album>(path)
  return <><QueryState query={album} />{album.data && <GalleryEdit key={album.data.version} album={album.data} path={path} />}</>
}

export function AcademySettings({ academy }: { academy: Academy }) {
  return <><AcademyForm academy={academy} /><Panel title="Venue photos"><Gallery academyId={academy.id} /></Panel></>
}

function CourtEditor({ court, academyId }: { court: Court; academyId: string }) {
  const [photos, setPhotos] = useState(false)
  return <Panel title={court.name}>
    <p>{readable(court.status)} · {court.hourlyRate ? rupees(court.hourlyRate) + '/hour' : 'Rate not set'}</p>
    <ActionForm label="Save court" perform={data => ownerWrite('/courts/' + segment(court.id), {
      name: field(data, 'name'), status: field(data, 'status'), hourlyRate: optional(data, 'hourlyRate'),
      playerBookingEnabled: data.has('playerBookingEnabled'),
    }, 'PATCH')}>
      <div className="owner-fields">
        <TextField name="name" label="Court name" initial={court.name} required />
        <TextField name="hourlyRate" label="Hourly rate (₹)" initial={court.hourlyRate} type="number" />
        <label>Status<select name="status" defaultValue={court.status}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      </div>
      <label><input type="checkbox" name="playerBookingEnabled" defaultChecked={court.playerBookingEnabled} /> Publish for player booking</label>
    </ActionForm>
    <button className="owner-secondary" onClick={() => setPhotos(value => !value)}>{photos ? 'Hide photos' : 'Manage court photos'}</button>
    {photos && <Gallery academyId={academyId} courtId={court.id} />}
  </Panel>
}

export function Courts({ academy }: { academy: Academy }) {
  const path = '/academies/' + segment(academy.id) + '/courts'
  const courts = useOwnerQuery<Court[]>(path)
  return <>
    <Panel title="Add a court"><ActionForm label="Add court" reset perform={data => ownerWrite(path, { name: field(data, 'name') })}>
      <TextField name="name" label="Court name" required />
    </ActionForm></Panel>
    <QueryState query={courts} />
    {courts.data?.length === 0 && <p>No courts added.</p>}
    <div className="owner-grid">{courts.data?.map(court => <CourtEditor key={court.id} court={court} academyId={academy.id} />)}</div>
  </>
}
