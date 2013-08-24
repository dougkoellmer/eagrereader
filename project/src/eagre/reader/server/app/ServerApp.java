package eagre.reader.server.app;

import java.util.logging.Logger;

import swarm.server.account.sm_s;
import swarm.server.app.bhA_ServerApp;
import swarm.server.app.bhServerAppConfig;
import swarm.server.handlers.admin.createGrid;
import swarm.server.transaction.bhE_AdminRequestPath;
import swarm.shared.transaction.bhE_RequestPath;
import eagre.reader.server.entities.ServerBookGrid;
import eagre.reader.server.homecells.PrototypeCellCreator;
import eagre.reader.shared.app.bhS_App;

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
		config.publicRecaptchaKey = bhS_App.PUBLIC_RECAPTCHA_KEY;
		
		config.appId = "er";
		
		super.entryPoint(config);
		
		setAdminHandler(new createGrid(ServerBookGrid.class), bhE_AdminRequestPath.createGrid);
		
		//--- DRK > For now disabling sign ups...also disabled on client.
		sm_s.txnMngr.setRequestHandler(null, bhE_RequestPath.signUp);
	}
}
