package eagre.reader.client.app;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.*;

import b33hive.client.app.bhA_ClientApp;
import b33hive.client.app.bhE_Platform;
import b33hive.client.app.bhE_StartUpStage;
import b33hive.client.app.bhPlatformInfo;
import b33hive.client.app.bhClientAppConfig;
import b33hive.client.app.bh_c;
import b33hive.client.code.bhClientCodeCompiler;
import b33hive.client.input.bhBrowserHistoryManager;
import b33hive.client.input.bhBrowserAddressManager;
import b33hive.client.input.bhClickManager;
import b33hive.client.thirdparty.json.bhGwtJsonFactory;
import b33hive.client.managers.bhClientAccountManager;
import b33hive.client.managers.bhCellAddressManager;
import b33hive.client.managers.bhGridManager;
import b33hive.client.managers.bhUserManager;
import b33hive.client.thirdparty.captcha.bhRecaptchaWrapper;
import b33hive.client.states.*;
import b33hive.client.states.account.StateMachine_Account;
import b33hive.client.states.account.State_AccountStatusPending;
import b33hive.client.states.account.State_SignInOrUp;
import b33hive.client.states.account.State_ManageAccount;
import b33hive.client.states.camera.StateMachine_Camera;
import b33hive.client.states.camera.State_CameraFloating;
import b33hive.client.states.camera.State_CameraSnapping;
import b33hive.client.states.camera.State_GettingMapping;
import b33hive.client.states.camera.State_ViewingCell;
import b33hive.client.states.code.StateMachine_EditingCode;
import b33hive.client.states.code.State_EditingCode;
import b33hive.client.states.code.State_EditingCodeBlocker;
import b33hive.client.time.bhU_Time;
import b33hive.client.transaction.bhClientTransactionManager;
import b33hive.client.thirdparty.transaction.bhGwtRequestDispatcher;
import b33hive.client.transaction.bhInlineRequestDispatcher;
import b33hive.client.ui.bhE_ZIndex;
import b33hive.client.ui.bhS_UI;
import b33hive.client.ui.bhViewConfig;
import b33hive.client.ui.bhViewController;
import b33hive.client.ui.tabs.bhI_Tab;
import b33hive.client.ui.tabs.code.bhCellSandbox;
import b33hive.client.ui.tabs.code.bhCodeEditorTab;
import b33hive.client.ui.tooltip.bhE_ToolTipType;
import b33hive.client.ui.tooltip.bhToolTipManager;
import b33hive.server.transaction.bhE_AdminRequestPath;
import b33hive.shared.bhE_AppEnvironment;
import b33hive.shared.app.bh;
import b33hive.shared.app.bhAppConfig;
import b33hive.shared.app.bhS_App;
import b33hive.shared.app.bhA_App;
import b33hive.shared.code.bhA_CodeCompiler;
import b33hive.shared.debugging.bhI_AssertionDelegate;
import b33hive.shared.debugging.bhTelemetryAssert;
import b33hive.shared.debugging.bhU_Debug;
import b33hive.shared.json.bhA_JsonFactory;
import b33hive.shared.json.bhJsonHelper;
import b33hive.shared.reflection.bhI_Class;
import b33hive.shared.statemachine.bhA_Action;
import b33hive.shared.statemachine.bhA_State;
import b33hive.shared.statemachine.bhA_StateMachine;
import b33hive.shared.structs.bhCellAddress;
import b33hive.shared.time.bhI_TimeSource;
import b33hive.shared.transaction.bhE_RequestPath;
import b33hive.shared.transaction.bhE_TelemetryRequestPath;
import b33hive.shared.transaction.bhRequestPathManager;

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
