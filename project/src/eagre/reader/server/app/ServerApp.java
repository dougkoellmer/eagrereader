package eagre.reader.server.app;

import java.util.logging.Logger;

import b33hive.server.account.bh_s;
import b33hive.server.app.bhA_ServerApp;
import b33hive.server.app.bhServerAppConfig;
import b33hive.server.handlers.admin.createGrid;
import b33hive.server.transaction.bhE_AdminRequestPath;
import b33hive.shared.transaction.bhE_RequestPath;
import eagre.reader.server.entities.ServerBookGrid;
import eagre.reader.server.homecells.PrototypeCellCreator;

public final class ServerApp extends bhA_ServerApp
{
	private static final Logger s_logger = Logger.getLogger(ServerApp.class.getName());

	ServerApp()
	{
		super();
		
		bhServerAppConfig config = new bhServerAppConfig();
		
		config.databaseUrl = "jdbc:google:rdbms://eagrereader:eagrereaderdb/";
		config.accountsDatabase = "er_accounts";
		config.telemetryDatabase = "er_telemetry";
		config.T_homeCellCreator = PrototypeCellCreator.class;
		config.gridExpansionDelta = 1;
		config.startingZ = 128;
		
		config.mainPage = "http://reader.eagreinteractive.com";
		
		config.privateRecaptchaKey = "6LdrmOUSAAAAAEg6K9DUYLIXJ11qBMIYL6qrP8HF";
		config.publicRecaptchaKey = "6LdrmOUSAAAAAJakkVeEWYa6iatpT3YA6tNemg5I";
		
		config.appId = "er";
		
		super.entryPoint(config);
		
		setAdminHandler(new createGrid(PrototypeCellCreator.class, ServerBookGrid.class), bhE_AdminRequestPath.createGrid);
		
		//--- DRK > For now disabling sign ups...also disabled on client.
		bh_s.txnMngr.setRequestHandler(null, bhE_RequestPath.signUp);
	}
}
