package eagre.reader.client.app;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.*;

import swarm.client.app.bhA_ClientApp;
import swarm.client.app.bhE_Platform;
import swarm.client.app.bhE_StartUpStage;
import swarm.client.app.bhPlatformInfo;
import swarm.client.app.bhClientAppConfig;
import swarm.client.app.sm_c;
import swarm.client.code.bhClientCodeCompiler;
import swarm.client.input.bhBrowserHistoryManager;
import swarm.client.input.bhBrowserAddressManager;
import swarm.client.input.bhClickManager;
import swarm.client.thirdparty.json.bhGwtJsonFactory;
import swarm.client.managers.bhClientAccountManager;
import swarm.client.managers.bhCellAddressManager;
import swarm.client.managers.bhGridManager;
import swarm.client.managers.bhUserManager;
import swarm.client.thirdparty.captcha.bhRecaptchaWrapper;
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
import swarm.client.time.bhU_Time;
import swarm.client.transaction.bhClientTransactionManager;
import swarm.client.thirdparty.transaction.bhGwtRequestDispatcher;
import swarm.client.transaction.bhInlineRequestDispatcher;
import swarm.client.ui.bhE_ZIndex;
import swarm.client.ui.bhS_UI;
import swarm.client.ui.bhViewConfig;
import swarm.client.ui.bhViewController;
import swarm.client.ui.tabs.bhI_Tab;
import swarm.client.ui.tabs.code.bhCellSandbox;
import swarm.client.ui.tabs.code.bhCodeEditorTab;
import swarm.client.ui.tooltip.bhE_ToolTipType;
import swarm.client.ui.tooltip.bhToolTipManager;
import swarm.server.transaction.bhE_AdminRequestPath;
import swarm.shared.bhE_AppEnvironment;
import swarm.shared.app.sm;
import swarm.shared.app.bhAppConfig;
import swarm.shared.app.bhS_App;
import swarm.shared.app.bhA_App;
import swarm.shared.code.bhA_CodeCompiler;
import swarm.shared.debugging.bhI_AssertionDelegate;
import swarm.shared.debugging.bhTelemetryAssert;
import swarm.shared.debugging.bhU_Debug;
import swarm.shared.json.bhA_JsonFactory;
import swarm.shared.json.bhJsonHelper;
import swarm.shared.reflection.bhI_Class;
import swarm.shared.statemachine.bhA_Action;
import swarm.shared.statemachine.bhA_State;
import swarm.shared.statemachine.bhA_StateMachine;
import swarm.shared.structs.bhCellAddress;
import swarm.shared.time.bhI_TimeSource;
import swarm.shared.transaction.bhE_RequestPath;
import swarm.shared.transaction.bhE_TelemetryRequestPath;
import swarm.shared.transaction.bhRequestPathManager;

import eagre.reader.client.entities.BookGrid;
import eagre.reader.client.entities.ClientUser;
import eagre.reader.client.ui.ViewController;

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
public class ClientApp extends bhA_ClientApp implements EntryPoint
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
		super.startUp(bhE_StartUpStage.values()[0]);
	}
	
	private static bhClientAppConfig makeAppConfig()
	{
		bhClientAppConfig appConfig = new bhClientAppConfig();
		
		appConfig.cellHudHeight = 0;
		appConfig.minSnapTime	 = .5;
		appConfig.maxSnapTime = 1.5;
		appConfig.framerate_milliseconds = 33; // milliseconds between frames
		appConfig.backOffDistance = S_ClientApp.VIEWING_CELL_CLOSE_BUTTON_DISTANCE_OFFSET;
		appConfig.addressCacheSize = S_ClientApp.ADDRESS_CACHE_SIZE;
		appConfig.addressCacheExpiration_seconds = S_ClientApp.ADDRESS_CACHE_EXPIRATION;
		appConfig.codeCacheSize = S_ClientApp.CODE_CACHE_SIZE;
		appConfig.codeCacheExpiration_seconds = S_ClientApp.ADDRESS_CACHE_EXPIRATION;
		appConfig.floatingHistoryUpdateFreq_seconds = S_ClientApp.SET_HISTORY_STATE_MIN_FREQUENCY;
		appConfig.publicRecaptchaKey = eagre.reader.shared.app.bhS_App.PUBLIC_RECAPTCHA_KEY;
		appConfig.appId = "er";
		
		appConfig.user = new ClientUser();
		appConfig.grid = new BookGrid();
		
		return appConfig;
	}
	
	private static bhViewConfig makeViewConfig()
	{
		bhViewConfig viewConfig = new bhViewConfig();
		
		viewConfig.magnifierTickCount = 7;
		viewConfig.magFadeInTime_seconds = .5;
		viewConfig.defaultPageTitle = "Eagre Reader";
		
		return viewConfig;
	}
	
	@Override
	protected void stage_startViewManagers()
	{
		super.stage_startViewManagers();
		
		//TODO(DRK) Ugh, real hacky here.
		bhI_Tab[] tabs = {new bhCodeEditorTab()};
		m_viewConfig.tabs = tabs;
		m_viewConfig.stateEventListener = new ViewController(m_viewConfig, m_appConfig);		
	}
	
	@Override
	protected void stage_registerStateMachine()
	{
		super.stage_registerStateMachine();
	
		registerCodeEditingStates();
		List<Class<? extends bhA_State>> tabStates = new ArrayList<Class<? extends bhA_State>>();
		tabStates.add(StateMachine_EditingCode.class);
		bhA_State.register(new StateMachine_Tabs(tabStates));
	}
	
	@Override
	protected void stage_gunshotSound()
	{
		super.stage_gunshotSound();
		
		bhA_Action.perform(StateContainer_Base.HideSupplementState.class);
	}
}
