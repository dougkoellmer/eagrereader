package eagre.reader.client.app;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.*;

import swarm.client.app.smA_ClientApp;
import swarm.client.app.smE_Platform;
import swarm.client.app.smE_StartUpStage;
import swarm.client.app.smPlatformInfo;
import swarm.client.app.smClientAppConfig;
import swarm.client.app.smAppContext;
import swarm.client.code.smClientCodeCompiler;
import swarm.client.input.smBrowserHistoryManager;
import swarm.client.input.smBrowserAddressManager;
import swarm.client.input.smClickManager;
import swarm.client.thirdparty.json.smGwtJsonFactory;
import swarm.client.managers.smClientAccountManager;
import swarm.client.managers.smCellAddressManager;
import swarm.client.managers.smGridManager;
import swarm.client.managers.smUserManager;
import swarm.client.thirdparty.captcha.smRecaptchaWrapper;
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
import swarm.client.time.smU_Time;
import swarm.client.transaction.smClientTransactionManager;
import swarm.client.thirdparty.transaction.smGwtRequestDispatcher;
import swarm.client.transaction.smInlineRequestDispatcher;
import swarm.client.view.smE_ZIndex;
import swarm.client.view.smS_UI;
import swarm.client.view.smViewConfig;
import swarm.client.view.smViewController;
import swarm.client.view.tabs.smI_Tab;
import swarm.client.view.tabs.code.smCellSandbox;
import swarm.client.view.tabs.code.smCodeEditorTab;
import swarm.client.view.tooltip.smE_ToolTipType;
import swarm.client.view.tooltip.smToolTipManager;
import swarm.server.transaction.smE_AdminRequestPath;
import swarm.shared.smE_AppEnvironment;
import swarm.shared.app.smSharedAppContext;
import swarm.shared.app.smAppConfig;
import swarm.shared.app.smS_App;
import swarm.shared.app.smA_App;
import swarm.shared.code.smA_CodeCompiler;
import swarm.shared.debugging.smI_AssertionDelegate;
import swarm.shared.debugging.smTelemetryAssert;
import swarm.shared.debugging.smU_Debug;
import swarm.shared.json.smA_JsonFactory;
import swarm.shared.json.smJsonHelper;
import swarm.shared.reflection.smI_Class;
import swarm.shared.statemachine.smA_Action;
import swarm.shared.statemachine.smA_State;
import swarm.shared.statemachine.smA_StateMachine;
import swarm.shared.statemachine.smI_StateEventListener;
import swarm.shared.structs.smCellAddress;
import swarm.shared.time.smI_TimeSource;
import swarm.shared.transaction.smE_RequestPath;
import swarm.shared.transaction.smE_TelemetryRequestPath;
import swarm.shared.transaction.smRequestPathManager;

import eagre.reader.client.entities.BookGrid;
import eagre.reader.client.entities.ClientUser;
import eagre.reader.client.view.ViewController;
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
public class ClientApp extends smA_ClientApp implements EntryPoint
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
		super.startUp(smE_StartUpStage.values()[0]);
	}
	
	private static smClientAppConfig makeAppConfig()
	{
		smClientAppConfig appConfig = new smClientAppConfig();
		
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
		appConfig.publicRecaptchaKey = S_App.PUBLIC_RECAPTCHA_KEY;
		appConfig.appId = "er";
		
		appConfig.user = new ClientUser();
		appConfig.grid = new BookGrid();
		
		return appConfig;
	}
	
	private static smViewConfig makeViewConfig()
	{
		smViewConfig viewConfig = new smViewConfig();
		
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
		smI_Tab[] tabs = {new smCodeEditorTab(m_viewContext)};
		m_viewConfig.tabs = tabs;	
	}
	
	@Override
	protected void stage_registerStateMachine(smI_StateEventListener stateEventListener_null)
	{
		ViewController viewController = new ViewController(m_viewContext, m_viewConfig, m_appConfig);
		
		super.stage_registerStateMachine(viewController);
	
		registerCodeEditingStates();
		List<Class<? extends smA_State>> tabStates = new ArrayList<Class<? extends smA_State>>();
		tabStates.add(StateMachine_EditingCode.class);
		m_stateContext.registerState(new StateMachine_Tabs(tabStates));
	}
	
	@Override
	protected void stage_gunshotSound()
	{
		super.stage_gunshotSound();
		
		m_stateContext.performAction(Action_Base_HideSupplementState.class);
	}
}
