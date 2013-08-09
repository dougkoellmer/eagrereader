package eagre.reader.server.app;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

public class EntryPoint implements ServletContextListener
{	
	@Override
	public void contextInitialized(ServletContextEvent contextEvent)
	{
		new ServerApp();
	}
	
	@Override
	public void contextDestroyed(ServletContextEvent contextEvent)
	{
	}
}