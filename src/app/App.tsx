import { route, session, go, endSession, startLocalGame, toast } from './state';
import { Home } from './Home';
import { Catalog } from './Catalog';
import { Setup } from './Setup';
import { GameScreen } from './GameScreen';
import { SettingsScreen, PacksScreen, CampaignScreen, StatsScreen } from './Screens';
import { OnlineScreen, RoomScreen } from './Online';

function LocalPlay() {
  const ctrl = session.value;
  if (!ctrl) {
    go({ name: 'home' });
    return null;
  }
  return (
    <GameScreen
      key={ctrl.id}
      ctrl={ctrl}
      onLeave={() => {
        endSession();
        go({ name: 'home' });
      }}
      onReplay={() => startLocalGame(ctrl.module, ctrl.players, ctrl.meta)}
      onChangeGame={() => {
        const mode = ctrl.meta.mode;
        endSession();
        go({ name: 'catalog', mode });
      }}
    />
  );
}

export function App() {
  const r = route.value;
  let screen;
  switch (r.name) {
    case 'home':
      screen = <Home />;
      break;
    case 'catalog':
      screen = <Catalog mode={r.mode} />;
      break;
    case 'setup':
      screen = <Setup key={r.gameId + (r.preset ?? '') + (r.campaignLevel ?? '') + (r.daily ? 'd' : '')} mode={r.mode} gameId={r.gameId} preset={r.preset} campaignLevel={r.campaignLevel} daily={r.daily} />;
      break;
    case 'play':
      screen = <LocalPlay key={session.value?.id ?? 'x'} />;
      break;
    case 'online':
      screen = <OnlineScreen />;
      break;
    case 'room':
      screen = <RoomScreen code={r.code} />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'packs':
      screen = <PacksScreen />;
      break;
    case 'campaign':
      screen = <CampaignScreen />;
      break;
    case 'stats':
      screen = <StatsScreen />;
      break;
  }
  return (
    <>
      {screen}
      {toast.value && <div class="toast">{toast.value}</div>}
    </>
  );
}
