package eagre.reader.client.view;

import swarm.client.app.smClientAppConfig;
import swarm.client.states.Action_Base_HideSupplementState;
import swarm.client.view.smViewConfig;
import swarm.client.view.smViewController;
import swarm.client.view.smViewContext;
import swarm.client.view.cell.smVisualCellContainer;
import swarm.shared.statemachine.smA_Action;

public class ViewController extends smViewController
{
	public ViewController(smViewContext viewContext, smViewConfig config, smClientAppConfig appConfig)
	{
		super(viewContext, config, appConfig);
	}

	@Override
	protected void startUpCoreUI()
	{
		m_viewContext.stateContext.performAction(Action_Base_HideSupplementState.class);
		
		super.startUpCoreUI();
		
		smVisualCellContainer cellContainer = m_viewContext.splitPanel.getCellContainer();
		cellContainer.getCellContainerInner().getElement().getStyle().setBackgroundColor("#9DA1CA");
	}
}
