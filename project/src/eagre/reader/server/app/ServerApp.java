package eagre.reader.server.app;

import java.util.logging.Logger;

import swarm.server.app.smA_ServerApp;
import swarm.server.app.smServerAppConfig;
import swarm.server.handlers.admin.createGrid;
import swarm.server.transaction.smE_AdminRequestPath;
import swarm.shared.transaction.smE_RequestPath;
import eagre.reader.server.entities.ServerBookGrid;
import eagre.reader.server.homecells.PrototypeCellCreator;
import eagre.reader.shared.app.S_App;

public final class ServerApp extends smA_ServerApp
{
	private static final Logger s_logger = Logger.getLogger(ServerApp.class.getName());

	ServerApp()
	{
		super();
		
		smServerAppConfig config = new smServerAppConfig();
		
		config.databaseUrl = "jdbc:google:rdbms://eagrereader:eagrereaderdb/";
		config.accountsDatabase = "er_accounts";
		config.telemetryDatabase = "er_telemetry";
		config.T_homeCellCreator = PrototypeCellCreator.class;
		config.gridExpansionDelta = 1;
		config.startingZ = 128;
		
		config.mainPage = "http://reader.eagreinteractive.com";
		
		config.privateRecaptchaKey = "6LdrmOUSAAAAAEg6K9DUYLIXJ11qBMIYL6qrP8HF";
		config.publicRecaptchaKey = S_App.PUBLIC_RECAPTCHA_KEY;
		
		config.appId = "er";
		
		super.entryPoint(config);
		
		setAdminHandler(new createGrid(ServerBookGrid.class), smE_AdminRequestPath.createGrid);
		
		//--- DRK > For now disabling sign ups...also disabled on client.
		m_context.txnMngr.setRequestHandler(null, smE_RequestPath.signUp);
	}
}
