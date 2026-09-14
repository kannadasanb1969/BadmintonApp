// Controlled browser regression harness; never imported by the application.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route,useNavigate} from 'react-router-dom'
import Page from '../src/features/player/pages/PlayerTournamentListPage'
import LegacyEntries from '../src/features/player/pages/RegistrationsPage'
import Friendly from '../src/features/player/pages/FriendlyMatchesPage'
import Layout from '../src/layouts/PlayerLayout'
import apiClient from '../src/api/apiClient'
import {fixtureService} from '../src/features/fixtures/services/fixtureService'
import {usePlayerProfileStore} from '../src/features/player/store/playerProfileStore'
const categories=[{id:'singles',name:'Singles',eventType:'SINGLES',registrationPhase:'OPEN'}]
const base={status:'PUBLISHED',createdAt:'2026-09-12',startDate:'2099-09-30',registrationEndDate:'2099-09-28',venue:'Test Court',categories,completionStatus:'IN_PROGRESS'}
const tournaments=[{...base,id:'single',name:'My Singles Tournament'},{...base,id:'double',name:'My Doubles Tournament',categories:[{...categories[0],id:'doubles',name:'Doubles',eventType:'DOUBLES'}]},{...base,id:'cancelled',name:'Cancelled Tournament'},{...base,id:'complete',name:'Completed Tournament',completionStatus:'COMPLETED',categories:[{...categories[0],completionStatus:'COMPLETED',result:{id:'result',tournamentId:'complete',categoryId:'singles',completedAt:'2026-09-12',winnerParticipantId:'winner',winnerParticipantName:'Real result winner',winnerParticipantCode:'PLR1',runnerUpParticipantId:'runner',runnerUpParticipantName:'Real result runner',runnerUpParticipantCode:'PLR2'}}]}]
const registrations=[
 {id:'r1',registrationCode:'REG000022',tournamentId:'single',categoryId:'singles',playerId:'me',eventType:'SINGLES',status:'REGISTERED'},
 {id:'r2',registrationCode:'REG000023',tournamentId:'double',categoryId:'doubles',playerId:'partner',partnerId:'me',partnerType:'PLAYER',eventType:'DOUBLES',status:'REGISTERED'},
 {id:'r3',registrationCode:'REG000024',tournamentId:'cancelled',categoryId:'singles',playerId:'me',eventType:'SINGLES',status:'CANCELLED'},
 {id:'unrelated',registrationCode:'DO-NOT-SHOW',tournamentId:'single',categoryId:'singles',playerId:'other',eventType:'SINGLES',status:'REGISTERED'},
]
window.__requests=[]
apiClient.get=async path=>{
 window.__requests.push(path)
 if(path==='/api/tournaments')return {data:tournaments}
 if(path.startsWith('/api/tournaments/'))return {data:tournaments.find(t=>t.id===path.split('/').at(-1))}
 if(path==='/api/registrations/player/me')return {data:registrations}
 throw new Error(`Unexpected request ${path}`)
}
fixtureService.getFixtures=async()=>[{id:'published',tournamentId:'single',categoryId:'singles',status:'PUBLISHED'},{id:'draft',tournamentId:'double',categoryId:'doubles',status:'DRAFT'}]
usePlayerProfileStore.getState().createProfile({id:'me',fullName:'Current Player',playerCode:'PLR000001'})
function NavigationControl(){window.__navigate=useNavigate();return null}
if(location.pathname==='/')history.replaceState({},'', '/player/tournaments')
createRoot(document.getElementById('root')!).render(<BrowserRouter><NavigationControl/><Routes><Route path='/player' element={<Layout/>}>
 <Route path='tournaments' element={<Page/>}/><Route path='registrations' element={<LegacyEntries/>}/><Route path='entries' element={<LegacyEntries/>}/><Route path='friendly-matches' element={<Friendly/>}/>
 <Route path='tournaments/:id' element={<p>Tournament destination</p>}/><Route path='fixtures' element={<p>Fixture destination</p>}/>
</Route></Routes></BrowserRouter>)
