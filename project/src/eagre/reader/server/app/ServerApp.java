package eagre.reader.server.app;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.logging.Level;
import java.util.logging.Logger;

import b33hive.client.app.bhPlatformInfo;
import b33hive.client.transaction.bhClientTransactionManager;
import b33hive.server.account.bhAccountDatabase;
import b33hive.server.account.bh_s;
import b33hive.server.account.bhServerAccountManager;
import b33hive.server.app.bhA_ServerApp;
import b33hive.server.app.bhServerAppConfig;
import b33hive.server.code.bhServerCodeCompiler;
import b33hive.server.data.blob.bhBlobManagerFactory;
import b33hive.server.entities.bhServerGrid;
import b33hive.server.handlers.*;
import b33hive.server.handlers.admin.adminHandler;
import b33hive.server.handlers.admin.bhI_HomeCellCreator;
import b33hive.server.handlers.admin.clearCell;
import b33hive.server.handlers.admin.createGrid;
import b33hive.server.handlers.admin.deactivateUserCells;
import b33hive.server.handlers.admin.recompileCells;
import b33hive.server.handlers.admin.refreshHomeCells;
import b33hive.server.handlers.normal.*;
import b33hive.server.session.bhSessionManager;
import b33hive.server.telemetry.bhTelemetryDatabase;
import b33hive.server.thirdparty.json.bhServerJsonFactory;
import b33hive.server.transaction.bhE_AdminRequestPath;
import b33hive.server.transaction.bhE_DebugRequestPath;
import b33hive.server.transaction.bhI_RequestHandler;
import b33hive.server.transaction.bhI_TransactionScopeListener;
import b33hive.server.transaction.bhInlineTransactionManager;
import b33hive.server.transaction.bhServerTransactionManager;
import b33hive.shared.bhE_AppEnvironment;
import b33hive.shared.app.bh;
import b33hive.shared.app.bhA_App;
import b33hive.shared.app.bhS_App;
import b33hive.shared.debugging.bhI_AssertionDelegate;
import b33hive.shared.debugging.bhTelemetryAssert;
import b33hive.shared.debugging.bhU_Debug;
import b33hive.shared.json.bhJsonHelper;
import b33hive.shared.transaction.bhE_RequestPath;
import b33hive.shared.transaction.bhE_TelemetryRequestPath;
import b33hive.shared.transaction.bhI_RequestPath;
import b33hive.shared.transaction.bhRequestPathManager;

import com.google.appengine.api.rdbms.AppEngineDriver;
import com.google.gwt.user.client.Window;

import eagre.reader.server.data.sql.bhS_Sql;
import eagre.reader.server.entities.ServerBookGrid;
import eagre.reader.server.homecells.PrototypeCellCreator;

public final class ServerApp extends bhA_ServerApp
{
	private static final Logger s_logger = Logger.getLogger(ServerApp.class.getName());

	ServerApp()
	{
		super();
		
		bhServerAppConfig config = new bhServerAppConfig();
		
		config.accountDatabase = bhS_Sql.HOST + "er_accounts";
		config.telemetryDatabase = bhS_Sql.HOST + "er_telemetry";
		config.T_homeCellCreator = PrototypeCellCreator.class;
		config.gridExpansionDelta = 1;
		config.startingZ = 128;
		
		config.privateRecaptchaKey = "6LdrmOUSAAAAAEg6K9DUYLIXJ11qBMIYL6qrP8HF";
		config.publicRecaptchaKey = "6LdrmOUSAAAAAJakkVeEWYa6iatpT3YA6tNemg5I";
		
		config.appId = "er";
		
		super.entryPoint(config);
		
		addAdminHandler(new createGrid(PrototypeCellCreator.class, ServerBookGrid.class),	bhE_AdminRequestPath.createGrid);
	}
}
