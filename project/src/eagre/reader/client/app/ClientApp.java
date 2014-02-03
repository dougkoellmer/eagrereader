package eagre.reader.client.app;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.*;

import swarm.client.app.A_ClientApp;
import swarm.client.app.E_Platform;
import swarm.client.app.E_StartUpStage;
import swarm.client.app.PlatformInfo;
import swarm.client.app.ClientAppConfig;
import swarm.client.app.AppContext;
import swarm.client.code.ClientCodeCompiler;
import swarm.client.input.BrowserHistoryManager;
import swarm.client.input.BrowserAddressManager;
import swarm.client.input.ClickManager;
import swarm.client.thirdparty.json.GwtJsonFactory;
import swarm.client.managers.ClientAccountManager;
import swarm.client.managers.CellAddressManager;
import swarm.client.managers.GridManager;
import swarm.client.managers.UserManager;
import swarm.client.thirdparty.captcha.RecaptchaWrapper;
import swarm.client.states.*;
import swarm.client.states.account.StateMachine_Account;
import swarm.client.states.account.State_AccountStatusPending;
import swarm.client.states.account.State_SignInOrUp;
import swarm.client.states.account.State_ManageAccount;
import swarm.client.states.camera.StateMachine_Camera;
import swarm.client.states.camera.State_CameraFloating;
import swarm.client.states.camera.State_CameraSnapping;
import swarm.client.states.camera.State_GettingMapping;
import swarm.client.states.camera.State_ViewingCell;
import swarm.client.states.code.StateMachine_EditingCode;
import swarm.client.states.code.State_EditingCode;
import swarm.client.states.code.State_EditingCodeBlocker;
import swarm.client.time.U_Time;
import swarm.client.transaction.ClientTransactionManager;
import swarm.client.thirdparty.transaction.GwtRequestDispatcher;
import swarm.client.transaction.InlineRequestDispatcher;
import swarm.client.view.E_ZIndex;
import swarm.client.view.S_UI;
import swarm.client.view.ViewConfig;
import swarm.client.view.ViewController;
import swarm.client.view.tabs.I_Tab;
import swarm.client.view.tabs.code.CodeEditorTab;
import swarm.client.view.tooltip.E_ToolTipType;
import swarm.client.view.tooltip.ToolTipManager;
import swarm.server.transaction.E_AdminRequestPath;
import swarm.shared.E_AppEnvironment;
import swarm.shared.app.AppConfig;
import swarm.shared.app.S_CommonApp;
import swarm.shared.app.A_App;
import swarm.shared.code.A_CodeCompiler;
import swarm.shared.debugging.I_AssertionDelegate;
import swarm.shared.debugging.TelemetryAssert;
import swarm.shared.debugging.U_Debug;
import swarm.shared.json.A_JsonFactory;
import swarm.shared.json.JsonHelper;
import swarm.shared.reflection.I_Class;
import swarm.shared.statemachine.A_Action;
import swarm.shared.statemachine.A_State;
import swarm.shared.statemachine.A_StateMachine;
import swarm.shared.statemachine.I_StateEventListener;
import swarm.shared.structs.CellAddress;
import swarm.shared.time.I_TimeSource;
import swarm.shared.transaction.E_RequestPath;
import swarm.shared.transaction.E_TelemetryRequestPath;
import swarm.shared.transaction.RequestPathManager;
import eagre.reader.client.entities.BookGrid;
import eagre.reader.client.entities.ClientUser;
import eagre.reader.shared.app.S_App;

import com.google.gwt.core.client.EntryPoint;
import com.google.gwt.core.client.JavaScriptObject;
import com.google.gwt.dom.client.Document;
import com.google.gwt.dom.client.LinkElement;
import com.google.gwt.dom.client.Style.Unit;
import com.google.gwt.dom.client.StyleElement;
import com.google.gwt.logging.client.TextLogFormatter;
import com.google.gwt.user.client.Timer;
import com.google.gwt.user.client.Window;
import com.google.gwt.user.client.ui.RootPanel;

/**
 * Entry point classes define <code>onModuleLoad()</code>.
 */
public class ClientApp extends A_ClientApp implements EntryPoint
{
	private static final Logger s_logger = Logger.getLogger(ClientApp.class.getName());	
	
	public ClientApp()
	{
		super(makeAppConfig(), makeViewConfig());
	}
	
	/**
	 * This is the entry point method.
	 */
	public void onModuleLoad()
	{
		this.startUp(E_StartUpStage.values()[0]);
	}
	
	private static ClientAppConfig makeAppConfig()
	{
		ClientAppConfig appConfig = new ClientAppConfig();
		
		appConfig.cellHudHeight = S_ClientApp.CELL_HUD_HEIGHT;
		appConfig.minSnapTime	 = .5;
		appConfig.snapTimeRange = 1;
		appConfig.framerate_milliseconds = 33; // milliseconds between frames
		appConfig.backOffDistance = S_ClientApp.VIEWING_CELL_CLOSE_BUTTON_DISTANCE_OFFSET;
		appConfig.addressCacheSize = S_ClientApp.ADDRESS_CACHE_SIZE;
		appConfig.addressCacheExpiration_seconds = S_ClientApp.ADDRESS_CACHE_EXPIRATION;
		appConfig.codeCacheSize = S_ClientApp.CODE_CACHE_SIZE;
		appConfig.codeCacheExpiration_seconds = S_ClientApp.ADDRESS_CACHE_EXPIRATION;
		appConfig.floatingHistoryUpdateFreq_seconds = S_ClientApp.SET_HISTORY_STATE_MIN_FREQUENCY;
		appConfig.publicRecaptchaKey = S_App.PUBLIC_RECAPTCHA_KEY;
		appConfig.appId = "er";
		appConfig.verboseTransactions = false;
		appConfig.useVirtualSandbox = false;
		
		appConfig.user = new ClientUser();
		appConfig.grid = new BookGrid();
		
		return appConfig;
	}
	
	private static ViewConfig makeViewConfig()
	{
		ViewConfig viewConfig = new ViewConfig();
		
		viewConfig.magnifierTickCount = 7;
		viewConfig.magFadeInTime_seconds = .5;
		viewConfig.defaultPageTitle = "Eagre Reader";
		
		return viewConfig;
	}
	
	@Override
	protected void stage_browserSupportCheck()
	{
		super.stage_browserSupportCheck();
	}
	
	@Override
	protected void stage_startViewManagers()
	{
		super.stage_startViewManagers();
		
		//TODO(DRK) Ugh, real hacky here.
		I_Tab[] tabs = {new CodeEditorTab(m_viewContext)};
		m_viewConfig.tabs = tabs;	
	}
	
	@Override
	protected void stage_registerStateMachine(I_StateEventListener stateEventListener_null, Class<? extends A_State> consoleState_T_null)
	{
		ViewController viewController = new ViewController(m_viewContext, m_viewConfig, m_appConfig);
		
		super.stage_registerStateMachine(viewController, StateMachine_Tabs.class);
	
		registerCodeEditingStates();
		List<Class<? extends A_State>> tabStates = new ArrayList<Class<? extends A_State>>();
		tabStates.add(StateMachine_EditingCode.class);
		m_stateContext.registerState(new StateMachine_Tabs(tabStates));
	}
	
	@Override
	protected void stage_gunshotSound()
	{
		super.stage_gunshotSound();
		
		//m_stateContext.performAction(Action_Base_HideSupplementState.class);
	}
}
