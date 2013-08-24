package eagre.reader.server.homecells;

import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletContext;

import swarm.server.account.bhUserSession;
import swarm.server.account.sm_s;
import swarm.server.blobxn.bhBlobTransaction_AddCellToUser;
import swarm.server.blobxn.bhBlobTransaction_CreateCell;
import swarm.server.blobxn.bhBlobTransaction_SetCellAddress;
import swarm.server.blobxn.bhBlobTransaction_SetCellPrivileges;
import swarm.server.data.blob.bhBlobException;
import swarm.server.data.blob.bhE_BlobCacheLevel;
import swarm.server.data.blob.bhE_BlobTransactionType;
import swarm.server.data.blob.bhI_BlobManager;
import swarm.server.entities.bhE_GridType;
import swarm.server.entities.bhServerCell;
import swarm.server.entities.bhServerUser;
import swarm.server.handlers.bhU_CellCode;
import swarm.server.handlers.admin.bhI_HomeCellCreator;
import swarm.server.structs.bhServerCellAddress;
import swarm.server.structs.bhServerCellAddressMapping;
import swarm.server.structs.bhServerCode;
import swarm.server.structs.bhServerCodePrivileges;
import swarm.server.transaction.bhTransactionContext;
import swarm.shared.app.bhS_App;
import swarm.shared.code.bhCompilerResult;
import swarm.shared.code.bhE_CompilationStatus;
import swarm.shared.entities.bhE_CharacterQuota;
import swarm.shared.entities.bhE_CodeType;
import swarm.shared.structs.bhCodePrivileges;
import swarm.shared.structs.bhE_NetworkPrivilege;
import swarm.shared.structs.bhGridCoordinate;
import swarm.shared.transaction.bhE_ResponseError;
import swarm.shared.transaction.bhTransactionRequest;
import swarm.shared.transaction.bhTransactionResponse;

public class PrototypeCellCreator implements bhI_HomeCellCreator
{
	private static Logger s_logger = Logger.getLogger(PrototypeCellCreator.class.getName());
	
	private enum Book
	{
		ExploringGeology(173, 7, 5),
		ExploringGeography(180, 13, 3);
		
		private final int m_startImageIndex;
		private final int m_pageCount;
		private final int m_chapter;
		
		private Book(int startImageIndex, int pageCount, int chapter)
		{
			m_startImageIndex = startImageIndex;
			m_pageCount = pageCount;
			m_chapter = chapter;
		}
		
		public int getStartImageIndex()
		{
			return m_startImageIndex;
		}
		
		public int getPageCount()
		{
			return m_pageCount;
		}
		
		public int getChapter()
		{
			return m_chapter;
		}
	};
	
	@Override
	public void initialize(ServletContext context)
	{
	}
	
	private boolean createCell(Book book, int page, bhI_BlobManager blobManager, bhServerCodePrivileges privileges, bhTransactionResponse response)
	{
		int pageIndex = page - 1;
		
		bhGridCoordinate coordinate = new bhGridCoordinate(pageIndex, book.ordinal());
		bhServerCellAddressMapping mapping = new bhServerCellAddressMapping(bhE_GridType.ACTIVE, coordinate);
		
		bhServerCellAddress pageAddress = new bhServerCellAddress(book.name()+"/Page"+(pageIndex+100));
		bhServerCellAddress[] addresses;
		
		if( pageIndex == 0 )
		{
			bhServerCellAddress chapterAddress = new bhServerCellAddress(book.name()+"/Chapter"+book.getChapter());
			bhServerCellAddress bookAddress = new bhServerCellAddress(book.name());
			
			addresses = new bhServerCellAddress[3];
			addresses[0] = pageAddress;
			addresses[1] = chapterAddress;
			addresses[2] = bookAddress;
		}
		else
		{
			addresses = new bhServerCellAddress[1];
			addresses[0] = pageAddress;
		}
		
		if( bhU_CellCode.getCell(blobManager, mapping, response) == null )
		{
			bhBlobTransaction_CreateCell createCellTxn = new bhBlobTransaction_CreateCell(addresses, coordinate, privileges);
			
			try
			{
				createCellTxn.perform(bhE_BlobTransactionType.MULTI_BLOB_TYPE, 1);
			}
			catch (bhBlobException e)
			{
				response.setError(bhE_ResponseError.SERVER_EXCEPTION);
				
				return false;
			}
		}
		else
		{
			bhBlobTransaction_SetCellAddress setCellAddyTxn = new bhBlobTransaction_SetCellAddress(mapping, addresses);
			
			try
			{
				setCellAddyTxn.perform(bhE_BlobTransactionType.MULTI_BLOB_TYPE, 1);
			}
			catch (bhBlobException e)
			{
				response.setError(bhE_ResponseError.SERVER_EXCEPTION);
				
				return false;
			}
			
		}
	
		//--- DRK > Get the source code for the cell.
		String image = "/r.img/pages/IMG_0"+ (book.getStartImageIndex()+pageIndex)+".jpg";
		String code = "<html><head></head><body style='position:absolute; width:100%; height:100%; overflow:hidden;'><img src='"+image+"'/></body></html>";
		bhServerCode sourceCode = new bhServerCode(code, bhE_CodeType.SOURCE);
		
		//--- DRK > Get the cell itself.
		bhServerCell persistedCell = bhU_CellCode.getCellForCompile(blobManager, mapping, response);
	
		if( persistedCell == null )  return false;
		
		bhCompilerResult result = bhU_CellCode.compileCell(persistedCell, sourceCode, mapping);
		
		if( result.getStatus() != bhE_CompilationStatus.NO_ERROR )
		{
			s_logger.severe("Couldn't compile source code: ");
			
			response.setError(bhE_ResponseError.SERVICE_EXCEPTION);
			
			return false;
		}

		if( !bhU_CellCode.saveBackCompiledCell(blobManager, mapping, persistedCell, response) )
		{
			response.setError(bhE_ResponseError.SERVICE_EXCEPTION);
			
			return false;
		}
		
		return true;
	}

	@Override
	public void run(bhTransactionRequest request, bhTransactionResponse response, bhTransactionContext context, bhUserSession session, bhServerUser user)
	{
		bhServerCodePrivileges privileges = new bhServerCodePrivileges();
		privileges.setNetworkPrivilege(bhE_NetworkPrivilege.ALL);
		privileges.setCharacterQuota(bhE_CharacterQuota.TIER_1);
		
		bhI_BlobManager blobManager = sm_s.blobMngrFactory.create(bhE_BlobCacheLevel.LOCAL, bhE_BlobCacheLevel.PERSISTENT);
		
		for( int i = 0; i < Book.values().length; i++ )
		{
			Book book = Book.values()[i];
			
			for( int j = 0; j < book.getPageCount(); j++ )
			{
				this.createCell(book, j+1, blobManager, privileges, response);
			}
		}
	}
}
